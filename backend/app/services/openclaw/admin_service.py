"""Gateway admin lifecycle service."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import col

from app.core.agent_tokens import generate_agent_token, hash_agent_token
from app.core.auth import AuthContext
from app.core.time import utcnow
from app.db import crud
from app.integrations.openclaw_gateway import GatewayConfig as GatewayClientConfig
from app.integrations.openclaw_gateway import (
    OpenClawGatewayError,
    ensure_session,
    openclaw_call,
    send_message,
)
from app.models.activity_events import ActivityEvent
from app.models.agents import Agent
from app.models.approvals import Approval
from app.models.gateways import Gateway
from app.models.tasks import Task
from app.schemas.gateways import GatewayTemplatesSyncResult
from app.services.openclaw.constants import DEFAULT_HEARTBEAT_CONFIG
from app.services.openclaw.provisioning import (
    GatewayTemplateSyncOptions,
    MainAgentProvisionRequest,
    ProvisionOptions,
    provision_main_agent,
    sync_gateway_templates,
)
from app.services.openclaw.session_service import GatewayTemplateSyncQuery
from app.services.openclaw.shared import GatewayAgentIdentity

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession

    from app.models.users import User


class AbstractGatewayMainAgentManager(ABC):
    """Abstract manager for gateway-main agent naming/profile behavior."""

    @abstractmethod
    def build_main_agent_name(self, gateway: Gateway) -> str:
        raise NotImplementedError

    @abstractmethod
    def build_identity_profile(self) -> dict[str, str]:
        raise NotImplementedError


class DefaultGatewayMainAgentManager(AbstractGatewayMainAgentManager):
    """Default naming/profile strategy for gateway-main agents."""

    def build_main_agent_name(self, gateway: Gateway) -> str:
        return f"{gateway.name} Gateway Agent"

    def build_identity_profile(self) -> dict[str, str]:
        return {
            "role": "Gateway Agent",
            "communication_style": "direct, concise, practical",
            "emoji": ":compass:",
        }


class GatewayAdminLifecycleService:
    """Write-side gateway lifecycle service (CRUD, main agent, template sync)."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        main_agent_manager: AbstractGatewayMainAgentManager | None = None,
    ) -> None:
        self._session = session
        self._logger = logging.getLogger(__name__)
        self._main_agent_manager = main_agent_manager or DefaultGatewayMainAgentManager()

    @property
    def session(self) -> AsyncSession:
        return self._session

    @session.setter
    def session(self, value: AsyncSession) -> None:
        self._session = value

    @property
    def logger(self) -> logging.Logger:
        return self._logger

    @logger.setter
    def logger(self, value: logging.Logger) -> None:
        self._logger = value

    @property
    def main_agent_manager(self) -> AbstractGatewayMainAgentManager:
        return self._main_agent_manager

    @main_agent_manager.setter
    def main_agent_manager(self, value: AbstractGatewayMainAgentManager) -> None:
        self._main_agent_manager = value

    async def require_gateway(
        self,
        *,
        gateway_id: UUID,
        organization_id: UUID,
    ) -> Gateway:
        gateway = (
            await Gateway.objects.by_id(gateway_id)
            .filter(col(Gateway.organization_id) == organization_id)
            .first(self.session)
        )
        if gateway is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Gateway not found",
            )
        return gateway

    async def find_main_agent(self, gateway: Gateway) -> Agent | None:
        return (
            await Agent.objects.filter_by(gateway_id=gateway.id)
            .filter(col(Agent.board_id).is_(None))
            .first(self.session)
        )

    @staticmethod
    def extract_agent_id_from_entry(item: object) -> str | None:
        if isinstance(item, str):
            value = item.strip()
            return value or None
        if not isinstance(item, dict):
            return None
        for key in ("id", "agentId", "agent_id"):
            raw = item.get(key)
            if isinstance(raw, str) and raw.strip():
                return raw.strip()
        return None

    @staticmethod
    def extract_agents_list(payload: object) -> list[object]:
        if isinstance(payload, list):
            return [item for item in payload]
        if not isinstance(payload, dict):
            return []
        agents = payload.get("agents") or []
        if not isinstance(agents, list):
            return []
        return [item for item in agents]

    async def upsert_main_agent_record(self, gateway: Gateway) -> tuple[Agent, bool]:
        changed = False
        session_key = GatewayAgentIdentity.session_key(gateway)
        agent = await self.find_main_agent(gateway)
        main_agent_name = self.main_agent_manager.build_main_agent_name(gateway)
        identity_profile = self.main_agent_manager.build_identity_profile()
        if agent is None:
            agent = Agent(
                name=main_agent_name,
                status="provisioning",
                board_id=None,
                gateway_id=gateway.id,
                is_board_lead=False,
                openclaw_session_id=session_key,
                heartbeat_config=DEFAULT_HEARTBEAT_CONFIG.copy(),
                identity_profile=identity_profile,
            )
            self.session.add(agent)
            changed = True
        if agent.board_id is not None:
            agent.board_id = None
            changed = True
        if agent.gateway_id != gateway.id:
            agent.gateway_id = gateway.id
            changed = True
        if agent.is_board_lead:
            agent.is_board_lead = False
            changed = True
        if agent.name != main_agent_name:
            agent.name = main_agent_name
            changed = True
        if agent.openclaw_session_id != session_key:
            agent.openclaw_session_id = session_key
            changed = True
        if agent.heartbeat_config is None:
            agent.heartbeat_config = DEFAULT_HEARTBEAT_CONFIG.copy()
            changed = True
        if agent.identity_profile is None:
            agent.identity_profile = identity_profile
            changed = True
        if not agent.status:
            agent.status = "provisioning"
            changed = True
        if changed:
            agent.updated_at = utcnow()
            self.session.add(agent)
        return agent, changed

    async def gateway_has_main_agent_entry(self, gateway: Gateway) -> bool:
        if not gateway.url:
            return False
        config = GatewayClientConfig(url=gateway.url, token=gateway.token)
        target_id = GatewayAgentIdentity.openclaw_agent_id(gateway)
        try:
            payload = await openclaw_call("agents.list", config=config)
        except OpenClawGatewayError:
            return True
        for item in self.extract_agents_list(payload):
            if self.extract_agent_id_from_entry(item) == target_id:
                return True
        return False

    async def provision_main_agent_record(
        self,
        gateway: Gateway,
        agent: Agent,
        *,
        user: User | None,
        action: str,
        notify: bool,
    ) -> Agent:
        session_key = GatewayAgentIdentity.session_key(gateway)
        raw_token = generate_agent_token()
        agent.agent_token_hash = hash_agent_token(raw_token)
        agent.provision_requested_at = utcnow()
        agent.provision_action = action
        agent.updated_at = utcnow()
        if agent.heartbeat_config is None:
            agent.heartbeat_config = DEFAULT_HEARTBEAT_CONFIG.copy()
        self.session.add(agent)
        await self.session.commit()
        await self.session.refresh(agent)
        if not gateway.url:
            return agent
        try:
            await provision_main_agent(
                agent,
                MainAgentProvisionRequest(
                    gateway=gateway,
                    auth_token=raw_token,
                    user=user,
                    session_key=session_key,
                    options=ProvisionOptions(action=action),
                ),
            )
            await ensure_session(
                session_key,
                config=GatewayClientConfig(url=gateway.url, token=gateway.token),
                label=agent.name,
            )
            if notify:
                await send_message(
                    (
                        f"Hello {agent.name}. Your gateway provisioning was updated.\n\n"
                        "Please re-read AGENTS.md, USER.md, HEARTBEAT.md, and TOOLS.md. "
                        "If BOOTSTRAP.md exists, run it once then delete it. "
                        "Begin heartbeats after startup."
                    ),
                    session_key=session_key,
                    config=GatewayClientConfig(url=gateway.url, token=gateway.token),
                    deliver=True,
                )
            self.logger.info(
                "gateway.main_agent.provision_success gateway_id=%s agent_id=%s action=%s",
                gateway.id,
                agent.id,
                action,
            )
        except OpenClawGatewayError as exc:
            self.logger.warning(
                "gateway.main_agent.provision_failed_gateway gateway_id=%s agent_id=%s error=%s",
                gateway.id,
                agent.id,
                str(exc),
            )
        except (OSError, RuntimeError, ValueError) as exc:
            self.logger.error(
                "gateway.main_agent.provision_failed gateway_id=%s agent_id=%s error=%s",
                gateway.id,
                agent.id,
                str(exc),
            )
        except Exception as exc:  # pragma: no cover - defensive fallback
            self.logger.critical(
                "gateway.main_agent.provision_failed_unexpected gateway_id=%s agent_id=%s "
                "error_type=%s error=%s",
                gateway.id,
                agent.id,
                exc.__class__.__name__,
                str(exc),
            )
        return agent

    async def ensure_main_agent(
        self,
        gateway: Gateway,
        auth: AuthContext,
        *,
        action: str = "provision",
    ) -> Agent:
        self.logger.log(
            5,
            "gateway.main_agent.ensure.start gateway_id=%s action=%s",
            gateway.id,
            action,
        )
        agent, _ = await self.upsert_main_agent_record(gateway)
        return await self.provision_main_agent_record(
            gateway,
            agent,
            user=auth.user,
            action=action,
            notify=True,
        )

    async def ensure_gateway_agents_exist(self, gateways: list[Gateway]) -> None:
        for gateway in gateways:
            agent, gateway_changed = await self.upsert_main_agent_record(gateway)
            has_gateway_entry = await self.gateway_has_main_agent_entry(gateway)
            needs_provision = (
                gateway_changed or not bool(agent.agent_token_hash) or not has_gateway_entry
            )
            if needs_provision:
                await self.provision_main_agent_record(
                    gateway,
                    agent,
                    user=None,
                    action="provision",
                    notify=False,
                )

    async def clear_agent_foreign_keys(self, *, agent_id: UUID) -> None:
        now = utcnow()
        await crud.update_where(
            self.session,
            Task,
            col(Task.assigned_agent_id) == agent_id,
            col(Task.status) == "in_progress",
            assigned_agent_id=None,
            status="inbox",
            in_progress_at=None,
            updated_at=now,
            commit=False,
        )
        await crud.update_where(
            self.session,
            Task,
            col(Task.assigned_agent_id) == agent_id,
            col(Task.status) != "in_progress",
            assigned_agent_id=None,
            updated_at=now,
            commit=False,
        )
        await crud.update_where(
            self.session,
            ActivityEvent,
            col(ActivityEvent.agent_id) == agent_id,
            agent_id=None,
            commit=False,
        )
        await crud.update_where(
            self.session,
            Approval,
            col(Approval.agent_id) == agent_id,
            agent_id=None,
            commit=False,
        )

    async def sync_templates(
        self,
        gateway: Gateway,
        *,
        query: GatewayTemplateSyncQuery,
        auth: AuthContext,
    ) -> GatewayTemplatesSyncResult:
        self.logger.log(
            5,
            "gateway.templates.sync.start gateway_id=%s include_main=%s",
            gateway.id,
            query.include_main,
        )
        await self.ensure_gateway_agents_exist([gateway])
        result = await sync_gateway_templates(
            self.session,
            gateway,
            GatewayTemplateSyncOptions(
                user=auth.user,
                include_main=query.include_main,
                reset_sessions=query.reset_sessions,
                rotate_tokens=query.rotate_tokens,
                force_bootstrap=query.force_bootstrap,
                board_id=query.board_id,
            ),
        )
        self.logger.info("gateway.templates.sync.success gateway_id=%s", gateway.id)
        return result

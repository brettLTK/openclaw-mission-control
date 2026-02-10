"""Compatibility re-export for split OpenClaw service modules."""

from app.services.openclaw.admin_service import (
    AbstractGatewayMainAgentManager,
    DefaultGatewayMainAgentManager,
    GatewayAdminLifecycleService,
)
from app.services.openclaw.agent_service import (
    AbstractProvisionExecution,
    ActorContextLike,
    AgentLifecycleService,
    AgentUpdateOptions,
    AgentUpdateProvisionRequest,
    AgentUpdateProvisionTarget,
    BoardAgentProvisionExecution,
    MainAgentProvisionExecution,
)
from app.services.openclaw.coordination_service import (
    AbstractGatewayMessagingService,
    GatewayCoordinationService,
)
from app.services.openclaw.onboarding_service import BoardOnboardingMessagingService
from app.services.openclaw.session_service import GatewaySessionService, GatewayTemplateSyncQuery

__all__ = [
    "AbstractGatewayMainAgentManager",
    "DefaultGatewayMainAgentManager",
    "GatewayAdminLifecycleService",
    "AbstractProvisionExecution",
    "ActorContextLike",
    "AgentLifecycleService",
    "AgentUpdateOptions",
    "AgentUpdateProvisionRequest",
    "AgentUpdateProvisionTarget",
    "BoardAgentProvisionExecution",
    "MainAgentProvisionExecution",
    "AbstractGatewayMessagingService",
    "GatewayCoordinationService",
    "BoardOnboardingMessagingService",
    "GatewaySessionService",
    "GatewayTemplateSyncQuery",
]

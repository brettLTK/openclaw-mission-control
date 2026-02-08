from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from pathlib import Path

import anyio
from alembic import command
from alembic.config import Config
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app import models as _models
from app.core.config import settings

# Import model modules so SQLModel metadata is fully registered at startup.
_MODEL_REGISTRY = _models


def _normalize_database_url(database_url: str) -> str:
    if "://" not in database_url:
        return database_url
    scheme, rest = database_url.split("://", 1)
    if scheme == "postgresql":
        return f"postgresql+psycopg://{rest}"
    return database_url


async_engine: AsyncEngine = create_async_engine(
    _normalize_database_url(settings.database_url),
    pool_pre_ping=True,
)
async_session_maker = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
logger = logging.getLogger(__name__)


def _alembic_config() -> Config:
    alembic_ini = Path(__file__).resolve().parents[2] / "alembic.ini"
    alembic_cfg = Config(str(alembic_ini))
    alembic_cfg.attributes["configure_logger"] = False
    return alembic_cfg


def run_migrations() -> None:
    logger.info("Running database migrations.")
    command.upgrade(_alembic_config(), "head")
    logger.info("Database migrations complete.")


async def init_db() -> None:
    if settings.db_auto_migrate:
        versions_dir = Path(__file__).resolve().parents[2] / "migrations" / "versions"
        if any(versions_dir.glob("*.py")):
            logger.info("Running migrations on startup")
            await anyio.to_thread.run_sync(run_migrations)
            return
        logger.warning("No migration revisions found; falling back to create_all")

    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            try:
                await session.rollback()
            except Exception:
                logger.exception("Failed to rollback session after request error.")
            raise

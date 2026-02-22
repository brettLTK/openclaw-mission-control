"""Authentication bootstrap endpoints for the Mission Control API."""

from __future__ import annotations

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.auth import AuthContext, get_auth_context
from app.core.auth_mode import AuthMode
from app.core.config import settings
from app.schemas.errors import LLMErrorResponse
from app.schemas.users import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])
AUTH_CONTEXT_DEP = Depends(get_auth_context)


@router.post(
    "/bootstrap",
    response_model=UserRead,
    summary="Bootstrap Authenticated User Context",
    description=(
        "Resolve caller identity from auth headers and return the canonical user profile. "
        "This endpoint does not accept a request body."
    ),
    responses={
        status.HTTP_200_OK: {
            "description": "Authenticated user profile resolved from token claims.",
            "content": {
                "application/json": {
                    "example": {
                        "id": "11111111-1111-1111-1111-111111111111",
                        "clerk_user_id": "user_2abcXYZ",
                        "email": "alex@example.com",
                        "name": "Alex Chen",
                        "preferred_name": "Alex",
                        "pronouns": "they/them",
                        "timezone": "America/Los_Angeles",
                        "notes": "Primary operator for board triage.",
                        "context": "Handles incident coordination and escalation.",
                        "is_super_admin": False,
                    }
                }
            },
        },
        status.HTTP_401_UNAUTHORIZED: {
            "model": LLMErrorResponse,
            "description": "Caller is not authenticated as a user actor.",
            "content": {
                "application/json": {
                    "example": {
                        "detail": {"code": "unauthorized", "message": "Not authenticated"},
                        "code": "unauthorized",
                        "retryable": False,
                    }
                }
            },
        },
    },
)
async def bootstrap_user(auth: AuthContext = AUTH_CONTEXT_DEP) -> UserRead:
    """Return the authenticated user profile from token claims."""
    if auth.actor_type != "user" or auth.user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return UserRead.model_validate(auth.user)


class LoginRequest(BaseModel):
    """Request body for passphrase-based login."""

    passphrase: str


class LoginResponse(BaseModel):
    """Response body for successful login."""

    access_token: str


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Passphrase-based Login",
    description=(
        "Authenticate with a passphrase and receive an access token. "
        "Only available when auth_mode is 'local'."
    ),
    responses={
        status.HTTP_200_OK: {
            "description": "Login successful, access token returned.",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "your-access-token-here",
                    }
                }
            },
        },
        status.HTTP_401_UNAUTHORIZED: {
            "model": LLMErrorResponse,
            "description": "Invalid passphrase.",
            "content": {
                "application/json": {
                    "example": {
                        "detail": {"code": "unauthorized", "message": "Invalid passphrase"},
                        "code": "unauthorized",
                        "retryable": False,
                    }
                }
            },
        },
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": LLMErrorResponse,
            "description": "Login passphrase not configured.",
            "content": {
                "application/json": {
                    "example": {
                        "detail": {
                            "code": "service_unavailable",
                            "message": "Login passphrase not configured",
                        },
                        "code": "service_unavailable",
                        "retryable": False,
                    }
                }
            },
        },
    },
)
async def login(request: LoginRequest) -> LoginResponse:
    """Authenticate with passphrase and return access token."""
    # Only available in local auth mode
    if settings.auth_mode != AuthMode.LOCAL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login endpoint only available in local auth mode",
        )

    # Check if passphrase hash is configured
    if not settings.login_passphrase_hash:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login passphrase not configured",
        )

    # Verify passphrase
    try:
        passphrase_bytes = request.passphrase.encode("utf-8")
        hash_bytes = settings.login_passphrase_hash.encode("utf-8")
        is_valid = bcrypt.checkpw(passphrase_bytes, hash_bytes)
    except Exception:
        # Invalid hash format or bcrypt error
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid passphrase",
        )

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid passphrase",
        )

    # Return the access token
    return LoginResponse(access_token=settings.local_auth_token)

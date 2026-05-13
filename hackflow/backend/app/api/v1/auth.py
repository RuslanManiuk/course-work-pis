from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import CurrentUser, get_session
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import create_token_pair, decode_token, hash_password, verify_password
from app.db.models.user import User, UserRole
from app.db.models.profile import UserProfile
from app.schemas import (
    LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserResponse
)
from app.services.github_service import github_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    existing = await session.scalar(select(User).where(User.email == body.email))
    if existing:
        raise ConflictError("Email already registered")

    username_taken = await session.scalar(select(User).where(User.username == body.username))
    if username_taken:
        raise ConflictError("Username already taken")

    user = User(
        email=body.email,
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    session.add(user)
    await session.flush()

    profile = UserProfile(user_id=user.id)
    session.add(profile)
    await session.commit()
    await session.refresh(user)

    access, refresh = create_token_pair(user.id, user.role.value)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    user = await session.scalar(select(User).where(User.email == body.email))
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")
    if not user.is_active:
        raise UnauthorizedError("Account deactivated")

    access, refresh = create_token_pair(user.id, user.role.value)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(body: RefreshRequest, session: AsyncSession = Depends(get_session)):
    from jose import JWTError
    from uuid import UUID

    try:
        payload = decode_token(body.refresh_token)
    except JWTError:
        raise UnauthorizedError("Invalid refresh token")

    if payload.get("type") != "refresh":
        raise UnauthorizedError("Expected refresh token")

    user = await session.get(User, UUID(payload["sub"]))
    if not user or not user.is_active:
        raise UnauthorizedError()

    access, new_refresh = create_token_pair(user.id, user.role.value)
    return TokenResponse(access_token=access, refresh_token=new_refresh)


@router.get("/github")
async def github_login():
    """Redirect URL for GitHub OAuth. Frontend hits this to get redirect URL."""
    from app.core.config import get_settings
    import secrets

    settings = get_settings()
    state = secrets.token_urlsafe(16)
    url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&redirect_uri={settings.github_redirect_uri}"
        f"&scope=read:user,user:email"
        f"&state={state}"
    )
    return {"redirect_url": url, "state": state}


@router.get("/github/callback", response_model=TokenResponse)
async def github_callback(
    code: str,
    session: AsyncSession = Depends(get_session),
):
    token_data = await github_service.exchange_code_for_token(code)
    access_token_gh = token_data.get("access_token")
    if not access_token_gh:
        raise UnauthorizedError("GitHub OAuth failed")

    gh_user = await github_service.get_github_user(access_token_gh)
    github_id = str(gh_user["id"])
    github_username = gh_user.get("login", "")
    avatar_url = gh_user.get("avatar_url")
    email = gh_user.get("email") or f"{github_username}@github.local"

    # Upsert user
    user = await session.scalar(select(User).where(User.github_id == github_id))
    if not user:
        # Check if email already exists (may have registered manually)
        user = await session.scalar(select(User).where(User.email == email))
        if user:
            user.github_id = github_id
            user.github_username = github_username
            if avatar_url:
                user.avatar_url = avatar_url
        else:
            user = User(
                email=email,
                username=github_username,
                github_id=github_id,
                github_username=github_username,
                avatar_url=avatar_url,
                role=UserRole.hacker,
            )
            session.add(user)
            await session.flush()
            session.add(UserProfile(user_id=user.id))

    await session.commit()
    await session.refresh(user)

    access, refresh = create_token_pair(user.id, user.role.value)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser, session: AsyncSession = Depends(get_session)):
    await session.refresh(current_user, ["profile"])
    return current_user

from app.crud.users_crud import (
    create_user,
    get_user,
    get_users_list,
    get_by_username,
    delete_user,
)
from app.schemas.users_schema import UserRegisterRequest, Token, RefreshRequest
from app.core.config import settings
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)


from app.models.users_model import User
from app.models.refresh_token import RefreshToken

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from datetime import datetime, timezone, timedelta
import jwt
from uuid import uuid4


async def _issue_token_pair(db: AsyncSession, user_id: int) -> Token:
    """发行 token 对"""
    jti = str(uuid4())
    db.add(
        RefreshToken(
            user_id=user_id,
            jti=jti,
            expire_at=datetime.now(timezone.utc)
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    await db.flush()
    return Token(
        access_token=create_access_token(user_id=user_id),
        refresh_token=create_refresh_token(user_id=user_id, jti=jti),
    )


async def register(db: AsyncSession, user_create: UserRegisterRequest) -> User:
    """注册用户 并判断是否重名"""
    user = await get_by_username(db, user_create.username)
    if user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")
    # 用于防止 "先查后插有竞态" 提升用户体验
    try:
        return await create_user(db, user_create)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")


async def login(db: AsyncSession, username: str, password: str) -> Token:
    """用户登录;
    return Token"""
    user: User | None = await get_by_username(db, username)
    # 如果用户不存在，或者密码不正确
    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="用户或密码错误"
        )
    return await _issue_token_pair(db, user.id)


async def read(db: AsyncSession, user_id: int) -> User | None:
    """按 user_id 查询用户信息"""
    return await get_user(db, user_id)


async def read_users(db: AsyncSession) -> tuple[list[User], int]:
    """查询所有用户信息"""
    return await get_users_list(db)


async def delete(db: AsyncSession, user_id: int, password: str) -> None:
    """注销用户; 密码确认身份"""
    user = await get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    # 密码正确才能注销
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="密码错误")
    # 正常情况下 user 已存在; 只有并发删除时才可能返回 False
    if not await delete_user(db, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")


async def refresh(db: AsyncSession, refresh_token: str) -> Token:
    """刷新 access token"""
    try:
        info = decode_refresh_token(refresh_token)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_REFRESH_TOKEN",
                "message": "登录已失效，请重新登录",
            },
        )

    user = await db.get(User, info["user_id"])
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_REFRESH_TOKEN",
                "message": "用户不存在",
            },
        )

    stored = await db.scalar(
        select(RefreshToken).where(
            RefreshToken.user_id == info["user_id"], RefreshToken.jti == info["jti"]
        )
    )
    # 判断查询结果 若不存在，或者 revoked_at 有值
    if stored is None or stored.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_REFRESH_TOKEN",
                "message": "登录已失效，请重新登录",
            },
        )

    # 刷新就吊销原来的 refresh_token
    stored.revoked_at = datetime.now(timezone.utc)

    return await _issue_token_pair(db, info["user_id"])

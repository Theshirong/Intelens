from app.crud.users_crud import (
    create_user,
    get_user,
    get_users_list,
    get_by_username,
    delete_user,
    update_password,
)
from app.crud.refresh_token_crud import (
    delete_all_for_user,
    create_token_pair,
    revoke_by_jti,
    delete_useless,
)
from app.schemas.users_schema import (
    UserRegisterRequest,
    Token,
    RefreshRequest,
    UserPasswordRequest,
)

from app.core.security import verify_password, decode_refresh_token


from app.models.users_model import User
from app.models.refresh_token import RefreshTokenModel

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from datetime import datetime, timezone
import jwt


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
    return await create_token_pair(db, user.id)


async def logout(db: AsyncSession, refresh_token: str):
    """退出登录: 吊销 refresh_token"""
    try:
        info = decode_refresh_token(refresh_token)
    except jwt.PyJWTError:
        return
    await revoke_by_jti(db, info["jti"])


async def read(db: AsyncSession, user_id: int) -> User | None:
    """按 user_id 查询用户信息"""
    return await get_user(db, user_id)


async def read_users(
    db: AsyncSession, page: int, page_size: int
) -> tuple[list[User], int]:
    """查询所有用户信息"""
    return await get_users_list(db, page, page_size)


async def delete(db: AsyncSession, user_id: int, password: str) -> None:
    """注销用户; 密码确认身份"""
    user = await get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    # 密码正确才能注销
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="密码错误")
    # 先删除 token，再删用户
    await delete_all_for_user(db, user_id)
    # 正常情况下 user 已存在; 只有并发删除时才可能返回 False
    if not await delete_user(db, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")


async def admin_delete_user(db: AsyncSession, user_id: int):
    """管理员删除用户"""
    user = await get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    if user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权删除其他管理员",
        )
    await delete_all_for_user(db, user_id)
    if not await delete_user(db, user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")


async def refresh(db: AsyncSession, refresh_token: str) -> Token:
    """刷新 access token"""
    try:
        info = decode_refresh_token(refresh_token)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已失效，请重新登录"
        )

    user = await db.get(User, info["user_id"])
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在"
        )

    result = await db.execute(
        update(RefreshTokenModel)
        .where(
            RefreshTokenModel.jti == info["jti"],
            RefreshTokenModel.user_id == info["user_id"],
            RefreshTokenModel.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )
    if result.rowcount == 0:  # type: ignore[attr-defined]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录已失效，请重新登录",
        )

    # 清理过期以及被吊销的 token
    await delete_useless(db)

    return await create_token_pair(db, info["user_id"])


async def update_user_password(
    db: AsyncSession, user_id: int, data: UserPasswordRequest
) -> None:
    """用户修改密码"""
    try:
        await update_password(db, user_id, data)
    except LookupError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="用户不存在")
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="旧密码错误")

    await delete_all_for_user(db, user_id)

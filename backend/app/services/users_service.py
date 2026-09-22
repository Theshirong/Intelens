from app.crud.users_crud import (
    create_user,
    get_user,
    get_users_list,
    get_by_username,
    delete_user,
    update_password,
    update_username,
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
    UserUpdateRequest,
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
    # 400 而非 401: 401 专指 token 失效, 前端会触发刷新重试
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码错误")
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
        # 旧密码错误属于业务校验失败, 用 400 避免与 token 失效的 401 混淆
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="旧密码错误")

    await delete_all_for_user(db, user_id)


async def update_profile(
    db: AsyncSession, user_id: int, data: UserUpdateRequest
) -> User:
    """
    修改个人信息;
    目前只支持改用户名: 改的是登录名, 论坛帖子/评论里的作者名会跟着变
    """
    user = await get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    username = data.username.strip() if data.username else None
    if username is None or username == user.username:
        # 没变化就当作成功, 不算错误
        return user

    # 先查重给个明确的 409, 再用唯一索引兜住并发
    if await get_by_username(db, username):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")
    try:
        return await update_username(db, user_id, username)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")

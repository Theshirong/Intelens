from typing import Annotated
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import status, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

from app.core.database import get_db
from app.core.security import decode_access_token
from app.crud.users_crud import get_user
from app.models.users_model import User

SessionDep = Annotated[AsyncSession, Depends(get_db)]

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    cred: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: SessionDep,
) -> User:
    """鉴权 token, 返回用户"""
    # 将 HTTPBearer(auto_error=False), 自定义返回401
    if cred is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证凭证",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = cred.credentials
    try:
        user_id = decode_access_token(token)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录已失效，请重新登录",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await get_user(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在"
        )
    return user


async def get_current_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    """要求用户数管理员"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限"
        )

    return current_user

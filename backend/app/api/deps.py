from typing import Annotated
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import status, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import jwt

from app.core.database import get_db
from app.core.security import decode_access_token
from app.crud.users_crud import get_user
from app.models.users_model import User

SessionDep = Annotated[AsyncSession, Depends(get_db)]

oauth_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")


async def get_current_user(
    token: str = Depends(oauth_scheme), db: AsyncSession = Depends(get_db)
) -> User:
    """鉴权 token, 返回用户"""
    try:
        user_id = decode_access_token(token)
    except jwt.PyJWKError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_ACCESS_TOKEN",
                "message": "登录已失效，请重新登录",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await get_user(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_ACCESS_TOKEN",
                "message": "用户不存在",
            },
        )
    return user

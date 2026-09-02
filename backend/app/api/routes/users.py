from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from typing import Annotated

# from app.api.deps import SessionDep
from app.services import users_service
from app.schemas.users_schema import (
    UserRegisterRequest,
    UserResponse,
    UserListResponse,
    UserLogin,
    UserDeleteRequest,
)
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.users_model import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/users_all", summary="查询所有用户", response_model=UserListResponse)
async def get_users(db: AsyncSession = Depends(get_db)):
    user_list, total = await users_service.read_users(db)
    return {
        "items": user_list,
        "total": total,
    }


@router.get("/{user_id}", summary="按 id 查询用户", response_model=UserResponse)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await users_service.read(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return user


@router.get("/me", summary="用户 token", response_model=UserResponse)
async def me(current_user: Annotated[User, Depends(get_current_user)]):
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
    )


@router.post("/register", summary="注册", response_model=UserResponse)
async def register(param: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    return await users_service.register(db, param)


@router.post("/login", summary="登录")
async def login(parm: UserLogin, db: AsyncSession = Depends(get_db)):
    token = await users_service.login(db, parm.username, parm.password)
    return {
        "access_token": token.access_token,
        "refresh_token": token.refresh_token,
        "token_type": "bearer",
        "msg": f"Login successfully, welcome back, {parm.username}",
    }


@router.delete("/{user_id}", summary="注销用户")
async def delete_user(
    user_id: int, param: UserDeleteRequest, db: AsyncSession = Depends(get_db)
):
    await users_service.delete(db, user_id, param.password)
    return {"msg": "注销成功"}

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from typing import Annotated

# from app.api.deps import SessionDep
from app.services import users_service
from app.schemas.users_schema import (
    UserRegisterRequest,
    UserResponse,
    UserLogin,
    UserDeleteRequest,
    UserPasswordRequest,
    RefreshRequest,
    UserUpdateRequest,
)
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.users_model import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", summary="查询当前用户信息", response_model=UserResponse)
async def me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user


@router.post("/register", summary="注册", response_model=UserResponse)
async def register(param: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    return await users_service.register(db, param)


@router.post("/login", summary="Custom login")
async def login(parm: UserLogin, db: AsyncSession = Depends(get_db)):
    token = await users_service.login(db, parm.username, parm.password)
    return {
        "access_token": token.access_token,
        "refresh_token": token.refresh_token,
        "token_type": "bearer",
        "msg": f"Login successfully, welcome back, {parm.username}",
    }


@router.post("/logout", summary="退出登录")
async def logout(param: RefreshRequest, db: AsyncSession = Depends(get_db)):
    await users_service.logout(db, param.refresh_token)
    return {"msg": "已退出登录"}


@router.post("/refresh", summary="刷新 token")
async def refresh(param: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token = await users_service.refresh(db, param.refresh_token)
    return {
        "access_token": token.access_token,
        "refresh_token": token.refresh_token,
        "token_type": "bearer",
        "msg": "refresh token successfully",
    }


@router.delete("/me", summary="注销自己的账号")
async def delete_me(
    param: UserDeleteRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    await users_service.delete(db, current_user.id, param.password)
    return {"msg": f"用户 {current_user.username} 注销成功"}


@router.patch("/me/password", summary="用户修改密码")
async def update_password(
    current_user: Annotated[User, Depends(get_current_user)],
    data: UserPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    await users_service.update_user_password(db, current_user.id, data)
    return {"msg": f"用户 {current_user.username} 密码修改成功, 请重新登录"}


@router.patch("/me", summary="用户修改自己的信息", response_model=UserResponse)
async def update_me(
    data: UserUpdateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    return await users_service.update_profile(db, current_user.id, data)

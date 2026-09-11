from fastapi import APIRouter, status, HTTPException, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from typing import Annotated

# from app.api.deps import SessionDep
from app.services import users_service
from app.schemas.common import Page, PageParams
from app.schemas.users_schema import (
    UserResponse,
    UserListResponse,
    UserDeleteRequest,
)
from app.core.database import get_db
from app.core.security import verify_password
from app.api.deps import get_current_admin
from app.models.users_model import User

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
)


@router.get("/users_all", summary="查询所有用户", response_model=Page[UserResponse])
async def get_users(
    params: Annotated[PageParams, Query()],
    db: AsyncSession = Depends(get_db),
):
    user_list, total = await users_service.read_users(
        db,
        page=params.page,
        page_size=params.page_size,
    )
    return Page.create(items=user_list, total=total, params=params)


@router.get("/{user_id}", summary="管理员按 id 查询用户", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    user = await users_service.read(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return user


@router.delete("/{user_id}", summary="管理员删除用户")
async def delete_user(
    user_id: int,
    param: UserDeleteRequest,
    current_user: Annotated[User, Depends(get_current_admin)],
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="管理员不能删除自己, 请使用注销账号接口",
        )
    if not verify_password(param.password, current_user.hashed_password):
        # 400 而非 401: 401 专指 token 失效, 前端会触发刷新重试
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码错误")
    await users_service.admin_delete_user(db, user_id)
    return {"msg": "删除成功"}

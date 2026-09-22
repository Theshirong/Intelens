from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.users_model import User
from app.schemas.common import Page
from app.schemas.forum_schema import (
    ForumCommentCreate,
    ForumCommentItem,
    ForumPostCreate,
    ForumPostDetail,
    ForumPostListItem,
    ForumQueryParams,
)
from app.services import forum_service

# 论坛是站内唯一需要登录的区域, 整个路由都要求认证
router = APIRouter(
    prefix="/forum",
    tags=["forum"],
    dependencies=[Depends(get_current_user)],
)

CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("/posts", summary="分页查询帖子列表", response_model=Page[ForumPostListItem])
async def get_posts(
    params: Annotated[ForumQueryParams, Query()],
    db: AsyncSession = Depends(get_db),
):
    posts, total = await forum_service.read_post_list(
        db, page=params.page, page_size=params.page_size, q=params.q
    )
    return Page.create(items=posts, total=total, params=params)


@router.post(
    "/posts",
    summary="发帖",
    response_model=ForumPostListItem,
    status_code=status.HTTP_201_CREATED,
)
async def create_post(
    payload: ForumPostCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    return await forum_service.publish_post(
        db, current_user, title=payload.title, content=payload.content
    )


@router.get(
    "/posts/{post_id}", summary="查询帖子详情", response_model=ForumPostDetail
)
async def get_post_detail(
    post_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await forum_service.read_post(db, post_id)


@router.delete("/posts/{post_id}", summary="删除帖子 (作者或管理员)")
async def delete_post(
    post_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await forum_service.remove_post(db, post_id, current_user)
    return {"msg": "帖子已删除"}


@router.post(
    "/posts/{post_id}/comments",
    summary="评论帖子",
    response_model=ForumCommentItem,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    post_id: int,
    payload: ForumCommentCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    return await forum_service.publish_comment(
        db, post_id, current_user, content=payload.content
    )


@router.delete("/comments/{comment_id}", summary="删除评论 (作者或管理员)")
async def delete_comment(
    comment_id: int,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await forum_service.remove_comment(db, comment_id, current_user)
    return {"msg": "评论已删除"}

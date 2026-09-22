from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.forum_crud import (
    create_comment,
    create_post,
    delete_comment,
    delete_post,
    get_comment,
    get_comment_counts,
    get_post,
    get_post_list,
    get_post_with_comments,
)
from app.models.forum_model import ForumCommentModel, ForumPostModel
from app.models.users_model import User


def _ensure_owner(user: User, author_id: int, action: str) -> None:
    """只有作者本人或管理员可以改动内容"""
    if user.id != author_id and user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"只能{action}自己发布的内容",
        )


async def read_post_list(
    db: AsyncSession, page: int, page_size: int, q: str | None = None
) -> tuple[list[ForumPostModel], int]:
    """分页查询帖子列表 (可按关键词过滤), 顺带补上评论数"""
    posts, total = await get_post_list(db, page, page_size, q)
    counts = await get_comment_counts(db, [post.id for post in posts])
    for post in posts:
        # 实例属性, 供响应模型读取, 不落库
        post.comment_count = counts.get(post.id, 0)
    return posts, total


async def read_post(db: AsyncSession, post_id: int) -> ForumPostModel:
    """按 id 查询帖子详情, 不存在时抛 404"""
    post = await get_post_with_comments(db, post_id)
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="帖子不存在或已删除"
        )
    post.comment_count = len(post.comments)
    return post


async def publish_post(
    db: AsyncSession, author: User, title: str, content: str
) -> ForumPostModel:
    """发帖"""
    post = await create_post(db, author.id, title.strip(), content.strip())
    # 作者已在手边, 直接挂上关系, 省一次查询
    post.author = author
    post.comment_count = 0
    return post


async def remove_post(db: AsyncSession, post_id: int, user: User) -> None:
    """删除帖子 (作者本人或管理员)"""
    post = await get_post(db, post_id)
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="帖子不存在或已删除"
        )
    _ensure_owner(user, post.author_id, "删除")
    await delete_post(db, post)


async def publish_comment(
    db: AsyncSession, post_id: int, author: User, content: str
) -> ForumCommentModel:
    """评论帖子"""
    post = await get_post(db, post_id)
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="帖子不存在或已删除"
        )
    comment = await create_comment(db, post_id, author.id, content.strip())
    comment.author = author
    return comment


async def remove_comment(db: AsyncSession, comment_id: int, user: User) -> None:
    """删除评论 (作者本人或管理员)"""
    comment = await get_comment(db, comment_id)
    if comment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="评论不存在或已删除"
        )
    _ensure_owner(user, comment.author_id, "删除")
    await delete_comment(db, comment)

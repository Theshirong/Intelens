from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forum_model import ForumCommentModel, ForumPostModel


async def create_post(
    db: AsyncSession, author_id: int, title: str, content: str
) -> ForumPostModel:
    """新建帖子"""
    post = ForumPostModel(title=title, content=content, author_id=author_id)
    db.add(post)
    await db.flush()
    return post


async def get_post(db: AsyncSession, post_id: int) -> ForumPostModel | None:
    """按 id 查询帖子 (带作者, 不含评论)"""
    result = await db.execute(
        select(ForumPostModel)
        .options(selectinload(ForumPostModel.author))
        .where(ForumPostModel.id == post_id)
    )
    return result.scalar_one_or_none()


async def get_post_with_comments(
    db: AsyncSession, post_id: int
) -> ForumPostModel | None:
    """按 id 查询帖子详情 (带作者与评论作者)"""
    result = await db.execute(
        select(ForumPostModel)
        .options(
            selectinload(ForumPostModel.author),
            selectinload(ForumPostModel.comments).selectinload(
                ForumCommentModel.author
            ),
        )
        .where(ForumPostModel.id == post_id)
    )
    return result.scalar_one_or_none()


async def get_post_list(
    db: AsyncSession, page: int, page_size: int, q: str | None = None
) -> tuple[list[ForumPostModel], int]:
    """
    分页查询帖子, 按发布时间倒序 (带作者);
    q 不为 None 时按标题/正文模糊匹配;
    return: (帖子列表, 总数)
    """
    query = select(ForumPostModel)
    if q:
        keyword = f"%{q.strip()}%"
        query = query.where(
            or_(
                ForumPostModel.title.ilike(keyword),
                ForumPostModel.content.ilike(keyword),
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar_one()

    result = await db.execute(
        query.options(selectinload(ForumPostModel.author))
        .order_by(ForumPostModel.created_at.desc(), ForumPostModel.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all()), total


async def get_comment_counts(
    db: AsyncSession, post_ids: list[int]
) -> dict[int, int]:
    """批量统计帖子的评论数, 避免逐条 count"""
    if not post_ids:
        return {}
    result = await db.execute(
        select(ForumCommentModel.post_id, func.count(ForumCommentModel.id))
        .where(ForumCommentModel.post_id.in_(post_ids))
        .group_by(ForumCommentModel.post_id)
    )
    return {post_id: count for post_id, count in result.all()}


async def create_comment(
    db: AsyncSession, post_id: int, author_id: int, content: str
) -> ForumCommentModel:
    """新建评论"""
    comment = ForumCommentModel(
        post_id=post_id, author_id=author_id, content=content
    )
    db.add(comment)
    await db.flush()
    return comment


async def get_comment(
    db: AsyncSession, comment_id: int
) -> ForumCommentModel | None:
    """按 id 查询单条评论"""
    result = await db.execute(
        select(ForumCommentModel).where(ForumCommentModel.id == comment_id)
    )
    return result.scalar_one_or_none()


async def delete_post(db: AsyncSession, post: ForumPostModel) -> None:
    """删除帖子 (评论随外键级联删除)"""
    await db.delete(post)


async def delete_comment(db: AsyncSession, comment: ForumCommentModel) -> None:
    """删除评论"""
    await db.delete(comment)

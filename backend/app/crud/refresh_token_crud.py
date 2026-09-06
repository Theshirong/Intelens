from app.schemas.users_schema import Token
from app.models.refresh_token import RefreshToken


from app.core.security import create_access_token, create_refresh_token
from app.core.config import settings

from sqlalchemy import select, delete, or_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from uuid import uuid4


async def revoke_by_jti(db: AsyncSession, jti: str) -> None:
    """吊销单个 refresh_token"""
    stored = await db.scalar(select(RefreshToken).where(RefreshToken.jti == jti))
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = datetime.now(timezone.utc)
        await db.flush()


async def delete_all_for_user(db: AsyncSession, user_id: int) -> None:
    """删除用户所有 refresh_token"""
    tokens = (
        await db.scalars(select(RefreshToken).where(RefreshToken.user_id == user_id))
    ).all()

    for token in tokens:
        await db.delete(token)
    await db.flush()


async def delete_useless(db: AsyncSession):
    """删除已过期或已吊销的 refresh_token 记录, 返回删除的行数"""
    await db.execute(
        delete(RefreshToken).where(
            or_(
                RefreshToken.expire_at < datetime.now(timezone.utc),
                RefreshToken.revoked_at.is_not(None),
            )
        )
    )


async def create_token_pair(db: AsyncSession, user_id: int) -> Token:
    """发行 token 对"""
    jti = str(uuid4())
    db.add(
        RefreshToken(
            user_id=user_id,
            jti=jti,
            expire_at=datetime.now(timezone.utc)
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    await db.flush()
    return Token(
        access_token=create_access_token(user_id=user_id),
        refresh_token=create_refresh_token(user_id=user_id, jti=jti),
    )

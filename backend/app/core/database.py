from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)


async def init_db():
    """初始化数据库: 建表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """session 连接最后提交"""
    async with AsyncSession(engine) as session:
        try:
            yield session
            # 将 session 所有操作保存
            await session.commit()
        except Exception:
            # 如果中间的操作有问题，就会回滚
            await session.rollback()
            raise

from sqlalchemy import event
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession

from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:
    """SQLite 连接参数

    默认的 rollback journal 模式下, 一个写事务会把所有读请求挡在外面 —— 采集
    在同一个进程里跑, 一轮要写几十秒, 期间 API 就集体卡住 (实测写成热日志后
    读连接会一直等等回滚)。换成 WAL: 读不阻塞写、写不阻塞读。

    busy_timeout 给写锁留出等待时间, 避免并发采集直接抛 database is locked。
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("pragma journal_mode=WAL")
    cursor.execute("pragma synchronous=NORMAL")
    cursor.execute("pragma busy_timeout=10000")
    cursor.close()


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

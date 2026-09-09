"""
启动入口
"""

from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.main import api_router
from app.core.config import settings
from app.core.database import init_db
from app.core.database import engine
from app.crud.users_crud import get_by_username, create_user_with_role
from app.tasks.crawl import run_crawl

# 采集轮询间隔 (小时)
CRAWL_INTERVAL_HOURS = 24


@asynccontextmanager
async def lifespan(app: FastAPI):
    """通过lifespan初始化数据库并启动定时采集"""
    logger.info("数据初始化")
    # 创建管理员用户
    async with AsyncSession(engine) as session:
        existing = await get_by_username(db=session, username=settings.ADMIN_USERNAME)
        if existing is None:
            await create_user_with_role(
                session,
                settings.ADMIN_USERNAME,
                settings.ADMIN_PASSWORD,
                "admin",
            )
            await session.commit()
            logger.info(f"已创建初始管理员: {settings.ADMIN_USERNAME}")

    # 定时采集: 随 API 进程常驻, 退出时一并停止
    scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")
    scheduler.add_job(
        run_crawl,
        "interval",
        hours=CRAWL_INTERVAL_HOURS,
        id="crawl",
        max_instances=1,  # 上一轮未结束时跳过本轮, 防止堆积
        coalesce=True,  # 错过的多轮合并为一轮
    )
    scheduler.start()
    # 启动后立刻跑一轮, 不用干等第一个间隔
    scheduler.add_job(run_crawl, "date", id="crawl-once")
    logger.info(f"采集调度已启动, 间隔 {CRAWL_INTERVAL_HOURS} 小时")

    yield

    scheduler.shutdown(wait=False)


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.include_router(api_router, prefix="/api/v1")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

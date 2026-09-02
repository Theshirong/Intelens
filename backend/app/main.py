"""
启动入口
"""

from contextlib import asynccontextmanager
from loguru import logger

from fastapi import FastAPI
from app.api.main import api_router

from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """通过lifespan初始化数据库"""
    logger.info("数据初始化")
    await init_db()
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.include_router(api_router, prefix="/api/v1")

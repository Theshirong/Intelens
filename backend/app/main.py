"""
启动入口
"""

from contextlib import asynccontextmanager
from loguru import logger

from fastapi import FastAPI
from app.api.main import api_router

from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("应用启动")
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.include_router(api_router, prefix="/api/v1")

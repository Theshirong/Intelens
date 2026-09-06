"""
启动入口
"""

from contextlib import asynccontextmanager
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings
from app.core.database import init_db
from app.core.database import engine
from app.crud.users_crud import get_by_username, create_user_with_role


@asynccontextmanager
async def lifespan(app: FastAPI):
    """通过lifespan初始化数据库"""
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

    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.include_router(api_router, prefix="/api/v1")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

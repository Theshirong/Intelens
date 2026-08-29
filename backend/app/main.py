"""
启动入口
"""

from fastapi import FastAPI, APIRouter
from app.api.main import api_router

from app.core.config import settings

app = FastAPI(
    title= settings.PROJECT_NAME
)

app.include_router(api_router, prefix="/api/v1")
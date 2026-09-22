"""
路由聚集管理
"""

from fastapi import APIRouter
from app.api.routes import users, admin, news, models, forum

api_router = APIRouter()

api_router.include_router(users.router)
api_router.include_router(admin.router)
api_router.include_router(news.router)
api_router.include_router(models.router)
api_router.include_router(forum.router)

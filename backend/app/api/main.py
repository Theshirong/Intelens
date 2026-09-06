"""
路由聚集管理
"""

from fastapi import APIRouter
from app.api.routes import users, admin

api_router = APIRouter()

api_router.include_router(users.router)
api_router.include_router(admin.router)

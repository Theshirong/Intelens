from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env")

    # 项目名称
    PROJECT_NAME: str = "Intelens"

    # 数据库配置（aiosqlite 为 SQLite 的异步驱动；生产环境换 postgresql+asyncpg）
    DATABASE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR / 'test.db'}"
    DEBUG: bool = True

    # 管理员
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"

    # jwt 配置
    SECRET_KEY: str = "r_AWC4_OxBAZTrB9D_Rq75F9fGSuFaNUnubnkjGlfpU"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7


settings = Settings()

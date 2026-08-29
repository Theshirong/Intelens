from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = 'sqlite:///test.db'
    DEBUG: bool = True

    PROJECT_NAME: str = 'Intelens'
    
    
settings = Settings()
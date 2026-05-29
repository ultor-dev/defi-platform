from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Blockchain
    WEB3_PROVIDER_URL: str = "http://localhost:8545"
    CHAIN_ID: int = 31337
    TOKEN_CONTRACT_ADDRESS: str = ""

    # Encryption key for private keys storage (Fernet)
    ENCRYPTION_KEY: str = ""

    # App
    DEBUG: bool = False
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    # Email
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "nurzhigitzhobonov24@gmail.com"
    FRONTEND_URL: str = "http://localhost:5173"

settings = Settings()

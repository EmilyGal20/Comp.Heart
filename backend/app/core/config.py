from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CompHeart"
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./compheart.db"
    allowed_origin: str = "http://localhost:8069"
    secret_key: str = "compheart-dev-secret"
    uploads_dir: str = "uploads"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_sender: str | None = None
    recurring_poll_seconds: int = 60

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

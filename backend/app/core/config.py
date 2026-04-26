from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "CompHeart"
    environment: str = "development"
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./compheart.db"
    allowed_origin: str = "http://localhost:8069"
    secret_key: str = "compheart-dev-secret"
    uploads_dir: str = "uploads"
    log_level: str = "INFO"
    auto_reset_db_on_schema_change: bool = True
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_sender: str | None = None
    recurring_poll_seconds: int = 60
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 300
    rate_limit_window_seconds: int = 60
    # Comma-separated browser origins, e.g. for LAN demo when the app is not same-origin:8086:
    #   CORS_EXTRA_ORIGINS=http://192.168.1.5:8069,http://myhost.local:8069
    cors_extra_origins: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

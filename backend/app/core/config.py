from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    gemini_api_key: str = "demo-key"
    gemini_model: str = "gemini-2.5-flash"
    gemini_report_model: str = "gemini-2.5-pro"
    gemini_embedding_model: str = "gemini-embedding-001"
    gemini_temperature: float = 0.2
    embedding_dimensions: int = 768
    google_cloud_project: str | None = None
    google_cloud_location: str = "global"
    google_genai_use_vertexai: bool = False
    google_application_credentials: str | None = None
    frontend_origin: str = "http://localhost:5173"
    geoserver_url: str = "http://geoserver:8080/geoserver"
    geoserver_admin_user: str = "admin"
    geoserver_admin_password: str = "geoserver"
    vector_backend: str = "pgvector"
    upload_dir: str = "/app/uploads"


settings = Settings()

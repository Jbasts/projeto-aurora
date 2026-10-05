from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Configuracoes(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/projeto-aurora"
    JWT_SECRET: str = "troque-isto"
    ACCESS_TOKEN_MINUTOS: int = 30
    REFRESH_TOKEN_DIAS: int = 7
    FRONTEND_URL: str = "http://localhost:5173"
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_REMETENTE: str = "nao-responda@projetoaurora.local"
    UPLOAD_DIR: str = "./uploads"
    ARQUIVOS_URL_SEGREDO: str = "troque-isto-tambem"
    MAX_TENTATIVAS_LOGIN: int = 5
    MINUTOS_BLOQUEIO: int = 5
    NOMINATIM_USER_AGENT: str = "ProjetoAurora/1.0 (contato@exemplo.com)"
    ADMIN_EMAIL: str = "admin@projetoaurora.local"
    ADMIN_SENHA: str = "TroqueEstaSenha1"


@lru_cache
def obter_configuracoes() -> Configuracoes:
    return Configuracoes()

from fastapi import APIRouter

from app.schemas.saude import SaudeResposta

router = APIRouter(tags=["saude"])


@router.get("/saude", response_model=SaudeResposta)
def verificar_saude() -> SaudeResposta:
    return SaudeResposta(status="ok")

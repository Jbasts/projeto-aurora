from pydantic import BaseModel


class SaudeResposta(BaseModel):
    status: str

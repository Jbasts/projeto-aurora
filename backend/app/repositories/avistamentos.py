from sqlalchemy.orm import Session

from app.entities import Avistamento


def adicionar(sessao: Session, avistamento: Avistamento) -> Avistamento:
    sessao.add(avistamento)
    sessao.flush()
    return avistamento

from sqlalchemy.orm import Session

from app.entities import LogAuditoria


def adicionar(sessao: Session, log: LogAuditoria) -> LogAuditoria:
    sessao.add(log)
    sessao.flush()
    return log

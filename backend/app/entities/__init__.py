"""Modelos ORM. Importar este pacote registra todas as tabelas em Base.metadata."""

from app.entities.avistamento import Avistamento
from app.entities.comum import (
    PerfilUsuario,
    StatusPessoa,
    StatusSolicitacao,
    StatusUsuario,
    TipoFoto,
    TipoSolicitacao,
)
from app.entities.log_auditoria import LogAuditoria
from app.entities.pessoa import Foto, Pessoa
from app.entities.usuario import (
    SolicitacaoAlteracao,
    TokenRedefinicaoSenha,
    TokenTrocaEmail,
    TokenVerificacaoEmail,
    Usuario,
)

__all__ = [
    "Avistamento",
    "Foto",
    "LogAuditoria",
    "PerfilUsuario",
    "Pessoa",
    "SolicitacaoAlteracao",
    "StatusPessoa",
    "StatusSolicitacao",
    "StatusUsuario",
    "TipoFoto",
    "TipoSolicitacao",
    "TokenRedefinicaoSenha",
    "TokenTrocaEmail",
    "TokenVerificacaoEmail",
    "Usuario",
]

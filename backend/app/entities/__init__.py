"""Modelos ORM. Importar este pacote registra todas as tabelas em Base.metadata."""

from app.entities.avistamento import Avistamento
from app.entities.comum import PerfilUsuario, StatusPessoa, StatusUsuario, TipoFoto
from app.entities.log_auditoria import LogAuditoria
from app.entities.pessoa import Foto, Pessoa
from app.entities.usuario import TokenRedefinicaoSenha, Usuario

__all__ = [
    "Avistamento",
    "Foto",
    "LogAuditoria",
    "PerfilUsuario",
    "Pessoa",
    "StatusPessoa",
    "StatusUsuario",
    "TipoFoto",
    "TokenRedefinicaoSenha",
    "Usuario",
]

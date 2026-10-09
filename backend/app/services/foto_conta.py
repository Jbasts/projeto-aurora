"""Foto das contas (todos os perfis). Obrigatória no cadastro; contas antigas enviam em Meu perfil.

Mesmo tratamento das fotos de pessoas em situação de rua: WEBP, sem metadados (EXIF/GPS) e
servida só por URL assinada.
"""

import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.entities import Usuario
from app.services import auditoria
from app.services.arquivos import Variante
from app.services.auditoria import AcaoAuditoria
from app.services.fotos import apagar_arquivos, diretorio_uploads, processar_imagem


def _nomes(foto_id: uuid.UUID) -> tuple[str, str]:
    return f"{foto_id}.webp", f"{foto_id}_miniatura.webp"


def caminho_arquivo(foto_id: uuid.UUID, variante: Variante) -> Path:
    original, miniatura = _nomes(foto_id)
    return diretorio_uploads() / (miniatura if variante == "miniatura" else original)


def salvar(dados: bytes, campo: str) -> uuid.UUID:
    """Valida, grava a foto e a miniatura no disco e devolve o id. Não mexe no banco."""
    original, miniatura = processar_imagem(dados, campo)
    foto_id = uuid.uuid4()
    nome, nome_miniatura = _nomes(foto_id)
    diretorio = diretorio_uploads()
    (diretorio / nome).write_bytes(original)
    (diretorio / nome_miniatura).write_bytes(miniatura)
    return foto_id


def apagar(foto_id: uuid.UUID) -> None:
    apagar_arquivos(*_nomes(foto_id))


def trocar(sessao: Session, usuario: Usuario, dados: bytes, ip: str | None) -> Usuario:
    """Meu perfil: envia a primeira foto ou substitui a atual (a anterior é apagada)."""
    nova = salvar(dados, "arquivo")
    anterior = usuario.foto_id
    try:
        usuario.foto_id = nova
        auditoria.registrar(
            sessao,
            AcaoAuditoria.MEUS_DADOS_ALTERADOS,
            usuario_id=usuario.id,
            entidade="usuario",
            entidade_id=usuario.id,
            detalhes={"campos": ["foto"]},
            ip=ip,
        )
        sessao.commit()
    except Exception:
        sessao.rollback()
        apagar(nova)
        raise
    # Só apaga do disco depois que o banco confirmou.
    if anterior is not None:
        apagar(anterior)
    return usuario

import uuid
from datetime import UTC, datetime

from fastapi import status
from sqlalchemy.orm import Session

from app.core.erros import ErroApi
from app.entities import Foto, PerfilUsuario, Pessoa, StatusPessoa, Usuario
from app.repositories import pessoas as repositorio_pessoas
from app.schemas.pessoas import PessoaCriacaoEntrada, PessoaEntrada
from app.services import auditoria, avistamentos
from app.services.auditoria import AcaoAuditoria

CAMPOS_EDITAVEIS = tuple(PessoaEntrada.model_fields)


def _nao_encontrada() -> ErroApi:
    return ErroApi(status.HTTP_404_NOT_FOUND, "NAO_ENCONTRADO", "Pessoa não encontrada.")


def _pode_ver(usuario: Usuario, pessoa: Pessoa) -> bool:
    """Pessoa usuária (PADRAO) só vê PSDR ativas (seção 2)."""
    return usuario.perfil != PerfilUsuario.PADRAO or pessoa.status == StatusPessoa.ATIVA


def _registrar(sessao: Session, acao: str, pessoa: Pessoa, usuario: Usuario, ip, **detalhes):
    auditoria.registrar(
        sessao,
        acao,
        usuario_id=usuario.id,
        entidade="pessoa",
        entidade_id=pessoa.id,
        detalhes=detalhes or None,
        ip=ip,
    )


def cadastrar(
    sessao: Session, dados: PessoaCriacaoEntrada, usuario: Usuario, ip: str | None
) -> Pessoa:
    """Cria a pessoa (status ATIVA) e, se informado, o primeiro avistamento (etapa 3)."""
    agora = datetime.now(UTC)
    pessoa = repositorio_pessoas.adicionar(
        sessao,
        Pessoa(
            **dados.model_dump(include=set(CAMPOS_EDITAVEIS)),
            consentimento_em=agora if dados.consentimento else None,
            status=StatusPessoa.ATIVA,
            cadastrada_por_id=usuario.id,
        ),
    )
    _registrar(sessao, AcaoAuditoria.PESSOA_CADASTRADA, pessoa, usuario, ip)
    if dados.avistamento is not None:
        avistamentos.registrar(
            sessao,
            pessoa,
            latitude=dados.avistamento.latitude,
            longitude=dados.avistamento.longitude,
            visto_em=dados.avistamento.visto_em,
            observacao=dados.avistamento.observacao,
            usuario=usuario,
            ip=ip,
        )
    sessao.commit()
    return pessoa


def atualizar(
    sessao: Session, pessoa_id: uuid.UUID, dados: PessoaEntrada, usuario: Usuario, ip: str | None
) -> Pessoa:
    pessoa = repositorio_pessoas.buscar_para_alterar(sessao, pessoa_id)
    if pessoa is None:
        raise _nao_encontrada()

    alterados = [c for c in CAMPOS_EDITAVEIS if getattr(dados, c) != getattr(pessoa, c)]
    if not alterados:
        return pessoa
    if "consentimento" in alterados:
        pessoa.consentimento_em = datetime.now(UTC) if dados.consentimento else None
    for campo in alterados:
        setattr(pessoa, campo, getattr(dados, campo))
    # Só os nomes dos campos: os valores são dados pessoais da PSDR (seção 3.11).
    _registrar(sessao, AcaoAuditoria.PESSOA_EDITADA, pessoa, usuario, ip, campos=alterados)
    sessao.commit()
    return pessoa


def inativar(
    sessao: Session, pessoa_id: uuid.UUID, motivo: str | None, usuario: Usuario, ip: str | None
) -> Pessoa:
    pessoa = repositorio_pessoas.buscar_para_alterar(sessao, pessoa_id)
    if pessoa is None:
        raise _nao_encontrada()
    if pessoa.status == StatusPessoa.INATIVA:
        raise ErroApi(status.HTTP_409_CONFLICT, "VALIDACAO", "Esta pessoa já está inativa.")
    pessoa.status = StatusPessoa.INATIVA
    pessoa.motivo_inativacao = motivo
    pessoa.inativada_em = datetime.now(UTC)
    pessoa.inativada_por_id = usuario.id
    _registrar(sessao, AcaoAuditoria.PESSOA_INATIVADA, pessoa, usuario, ip)
    sessao.commit()
    return pessoa


def reativar(sessao: Session, pessoa_id: uuid.UUID, usuario: Usuario, ip: str | None) -> Pessoa:
    pessoa = repositorio_pessoas.buscar_para_alterar(sessao, pessoa_id)
    if pessoa is None:
        raise _nao_encontrada()
    if pessoa.status == StatusPessoa.ATIVA:
        raise ErroApi(status.HTTP_409_CONFLICT, "VALIDACAO", "Esta pessoa já está ativa.")
    pessoa.status = StatusPessoa.ATIVA
    pessoa.motivo_inativacao = None
    pessoa.inativada_em = None
    pessoa.inativada_por_id = None
    _registrar(sessao, AcaoAuditoria.PESSOA_REATIVADA, pessoa, usuario, ip)
    sessao.commit()
    return pessoa


def visualizar(sessao: Session, pessoa_id: uuid.UUID, usuario: Usuario, ip: str | None) -> Pessoa:
    """Perfil da pessoa. Toda visualização gera auditoria (seção 11)."""
    pessoa = repositorio_pessoas.buscar_por_id(sessao, pessoa_id)
    if pessoa is None or not _pode_ver(usuario, pessoa):
        raise _nao_encontrada()
    _registrar(sessao, AcaoAuditoria.PESSOA_VISUALIZADA, pessoa, usuario, ip)
    sessao.commit()
    return pessoa


def sugestoes(sessao: Session, termo: str, usuario: Usuario) -> list[tuple[Pessoa, Foto | None]]:
    return repositorio_pessoas.sugestoes(
        sessao, termo.strip(), somente_ativas=usuario.perfil == PerfilUsuario.PADRAO
    )

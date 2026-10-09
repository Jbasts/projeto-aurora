"""Solicitações de troca de email e de CPF (Meu perfil → Solicitações da pessoa administradora).

Nenhuma troca vale sem aprovação de ADMIN. Até lá, o email e o CPF atuais continuam valendo
(login, recuperação de senha). Email: a pessoa primeiro abre o link enviado ao email novo
(prova que o email é dela); só então a solicitação aparece para a pessoa administradora.
O email e o CPF nunca vão para os detalhes da auditoria: só o tipo e o id da solicitação.
"""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import obter_configuracoes
from app.core.erros import ErroApi
from app.core.seguranca import gerar_token_redefinicao, hash_token_redefinicao
from app.emails import montar_email_troca
from app.entities import (
    SolicitacaoAlteracao,
    StatusSolicitacao,
    TipoSolicitacao,
    TokenTrocaEmail,
    Usuario,
)
from app.repositories import solicitacoes as repositorio
from app.repositories import tokens_troca_email as repositorio_tokens
from app.repositories import usuarios as repositorio_usuarios
from app.services import auditoria
from app.services.auditoria import AcaoAuditoria
from app.services.email import Email

MENSAGEM_EMAIL_IGUAL = "Este já é o email da sua conta."
MENSAGEM_EMAIL_EM_USO = "Este email já está em uso por outra conta."
MENSAGEM_CPF_IGUAL = "Este já é o CPF da sua conta."
MENSAGEM_CPF_EM_USO = "Este CPF já está cadastrado em outra conta."
MENSAGEM_LIMITE = "Você já pediu muitas trocas de email na última hora. Tente mais tarde."
MENSAGEM_EMAIL_CONFIRMADO = (
    "Email confirmado. Agora uma pessoa administradora vai analisar a troca. "
    "Até lá, continue usando o email atual."
)


def _erro_campo(campo: str, mensagem: str) -> ErroApi:
    return ErroApi(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "VALIDACAO",
        "Dados inválidos.",
        campos=[{"campo": campo, "mensagem": mensagem}],
    )


def _registrar(
    sessao: Session,
    acao: str,
    autor: Usuario,
    solicitacao: SolicitacaoAlteracao,
    ip: str | None,
) -> None:
    auditoria.registrar(
        sessao,
        acao,
        usuario_id=autor.id,
        entidade="usuario",
        entidade_id=solicitacao.usuario_id,
        detalhes={"tipo": solicitacao.tipo.value, "solicitacao_id": str(solicitacao.id)},
        ip=ip,
    )


def _cancelar_aberta(
    sessao: Session, usuario: Usuario, tipo: TipoSolicitacao, agora: datetime
) -> bool:
    """Uma solicitação nova substitui a que estiver em aberto do mesmo tipo."""
    anterior = repositorio.aberta_para_alterar(sessao, usuario.id, tipo)
    if anterior is None:
        return False
    anterior.status = StatusSolicitacao.CANCELADA
    anterior.decidido_em = agora
    if tipo == TipoSolicitacao.EMAIL:
        repositorio_tokens.invalidar_pendentes(sessao, usuario.id, agora)
    sessao.flush()
    return True


def _email_de_outra_conta(sessao: Session, email: str, usuario_id: uuid.UUID) -> bool:
    dono = repositorio_usuarios.buscar_por_email(sessao, email)
    return dono is not None and dono.id != usuario_id


def _cpf_de_outra_conta(sessao: Session, cpf: str, usuario_id: uuid.UUID) -> bool:
    dono = repositorio_usuarios.buscar_por_cpf(sessao, cpf)
    return dono is not None and dono.id != usuario_id


# --- Pela própria pessoa (Meu perfil) ---


def pedir_email(
    sessao: Session,
    usuario: Usuario,
    email_novo: str,
    ip: str | None,
    agora: datetime | None = None,
) -> Email:
    """Cria a solicitação (aguardando o link) e monta o email para o endereço novo.

    Não faz commit: quem chama confirma junto com o resto do pedido.
    """
    configuracoes = obter_configuracoes()
    agora = agora or datetime.now(UTC)

    if email_novo == usuario.email.lower():
        raise _erro_campo("email", MENSAGEM_EMAIL_IGUAL)
    if _email_de_outra_conta(sessao, email_novo, usuario.id):
        raise _erro_campo("email", MENSAGEM_EMAIL_EM_USO)
    links_na_ultima_hora = repositorio_tokens.contar_criados_desde(
        sessao, usuario.id, agora - timedelta(hours=1)
    )
    if links_na_ultima_hora >= configuracoes.MAX_REENVIOS_VERIFICACAO_POR_HORA:
        raise ErroApi(status.HTTP_429_TOO_MANY_REQUESTS, "MUITAS_REQUISICOES", MENSAGEM_LIMITE)

    _cancelar_aberta(sessao, usuario, TipoSolicitacao.EMAIL, agora)
    solicitacao = repositorio.adicionar(
        sessao,
        SolicitacaoAlteracao(
            usuario_id=usuario.id,
            tipo=TipoSolicitacao.EMAIL,
            valor_novo=email_novo,
            status=StatusSolicitacao.AGUARDANDO_EMAIL,
            criado_em=agora,
        ),
    )
    token, token_hash = gerar_token_redefinicao()
    repositorio_tokens.adicionar(
        sessao,
        TokenTrocaEmail(
            usuario_id=usuario.id,
            solicitacao_id=solicitacao.id,
            token_hash=token_hash,
            expira_em=agora + timedelta(hours=configuracoes.HORAS_VALIDADE_TOKEN_EMAIL),
            criado_em=agora,
        ),
    )
    _registrar(sessao, AcaoAuditoria.SOLICITACAO_CRIADA, usuario, solicitacao, ip)
    sessao.expire(usuario, ["solicitacoes"])
    return montar_email_troca(
        destinatario=email_novo,
        nome=usuario.nome,
        link=f"{configuracoes.FRONTEND_URL}/confirmar-novo-email?token={token}",
        horas_validade=configuracoes.HORAS_VALIDADE_TOKEN_EMAIL,
    )


def pedir_cpf(
    sessao: Session,
    usuario: Usuario,
    cpf_novo: str,
    ip: str | None,
    agora: datetime | None = None,
) -> SolicitacaoAlteracao:
    """Cria a solicitação, já pendente para a pessoa administradora. Não faz commit."""
    agora = agora or datetime.now(UTC)
    if cpf_novo == usuario.cpf:
        raise _erro_campo("cpf", MENSAGEM_CPF_IGUAL)
    if _cpf_de_outra_conta(sessao, cpf_novo, usuario.id):
        raise _erro_campo("cpf", MENSAGEM_CPF_EM_USO)

    _cancelar_aberta(sessao, usuario, TipoSolicitacao.CPF, agora)
    solicitacao = repositorio.adicionar(
        sessao,
        SolicitacaoAlteracao(
            usuario_id=usuario.id,
            tipo=TipoSolicitacao.CPF,
            valor_novo=cpf_novo,
            status=StatusSolicitacao.PENDENTE,
            criado_em=agora,
        ),
    )
    _registrar(sessao, AcaoAuditoria.SOLICITACAO_CRIADA, usuario, solicitacao, ip)
    sessao.expire(usuario, ["solicitacoes"])
    return solicitacao


def cancelar(
    sessao: Session, usuario: Usuario, tipo: TipoSolicitacao, agora: datetime | None = None
) -> Usuario:
    _cancelar_aberta(sessao, usuario, tipo, agora or datetime.now(UTC))
    sessao.commit()
    sessao.expire(usuario, ["solicitacoes"])
    return usuario


def confirmar_email(
    sessao: Session, token: str, ip: str | None, agora: datetime | None = None
) -> None:
    """Link aberto: o email novo é da pessoa. A solicitação passa a esperar a ADMIN."""
    agora = agora or datetime.now(UTC)
    registro = repositorio_tokens.buscar_por_hash(sessao, hash_token_redefinicao(token))
    solicitacao = (
        repositorio.buscar_para_alterar(sessao, registro.solicitacao_id) if registro else None
    )
    if (
        registro is None
        or solicitacao is None
        or registro.usado_em is not None
        or registro.expira_em <= agora
        or solicitacao.status != StatusSolicitacao.AGUARDANDO_EMAIL
    ):
        raise ErroApi(
            status.HTTP_400_BAD_REQUEST,
            "TOKEN_INVALIDO",
            "Este link não é mais válido. Ele expirou, já foi usado ou a troca foi cancelada. "
            "Peça a troca de novo em Meu perfil.",
        )
    solicitacao.status = StatusSolicitacao.PENDENTE
    solicitacao.email_confirmado_em = agora
    repositorio_tokens.invalidar_pendentes(sessao, registro.usuario_id, agora)
    usuario = repositorio_usuarios.buscar_por_id(sessao, registro.usuario_id)
    assert usuario is not None  # FK garante
    _registrar(sessao, AcaoAuditoria.SOLICITACAO_EMAIL_CONFIRMADO, usuario, solicitacao, ip)
    sessao.commit()


# --- Pela pessoa administradora (tela Solicitações) ---


def listar(
    sessao: Session,
    status_solicitacao: StatusSolicitacao | None,
    tipo: TipoSolicitacao | None,
    pagina: int,
    tamanho: int,
) -> tuple[list[SolicitacaoAlteracao], int]:
    return repositorio.listar(
        sessao, status=status_solicitacao, tipo=tipo, pagina=pagina, tamanho=tamanho
    )


def decidir(
    sessao: Session,
    admin: Usuario,
    solicitacao_id: uuid.UUID,
    aprovar: bool,
    ip: str | None,
    agora: datetime | None = None,
) -> SolicitacaoAlteracao:
    """Aprovada, o email ou o CPF da conta muda na hora. Recusada, nada muda."""
    agora = agora or datetime.now(UTC)
    solicitacao = repositorio.buscar_para_alterar(sessao, solicitacao_id)
    if solicitacao is None:
        raise ErroApi(status.HTTP_404_NOT_FOUND, "NAO_ENCONTRADO", "Solicitação não encontrada.")
    if solicitacao.status != StatusSolicitacao.PENDENTE:
        raise ErroApi(
            status.HTTP_409_CONFLICT,
            "SOLICITACAO_ENCERRADA",
            "Esta solicitação não está mais pendente. Atualize a lista.",
        )
    usuario = repositorio_usuarios.buscar_por_id_para_alterar(sessao, solicitacao.usuario_id)
    assert usuario is not None  # FK garante

    eh_email = solicitacao.tipo == TipoSolicitacao.EMAIL
    erro_em_uso = ErroApi(
        status.HTTP_409_CONFLICT,
        "EMAIL_EM_USO" if eh_email else "CPF_EM_USO",
        f"{'Este email' if eh_email else 'Este CPF'} já está em uso por outra conta. "
        "Recuse a solicitação.",
    )
    if aprovar:
        if eh_email:
            if _email_de_outra_conta(sessao, solicitacao.valor_novo, usuario.id):
                raise erro_em_uso
            usuario.email = solicitacao.valor_novo
            usuario.email_verificado_em = solicitacao.email_confirmado_em or agora
        else:
            if _cpf_de_outra_conta(sessao, solicitacao.valor_novo, usuario.id):
                raise erro_em_uso
            usuario.cpf = solicitacao.valor_novo

    solicitacao.status = StatusSolicitacao.APROVADA if aprovar else StatusSolicitacao.RECUSADA
    solicitacao.decidido_por_id = admin.id
    solicitacao.decidido_em = agora
    _registrar(
        sessao,
        AcaoAuditoria.SOLICITACAO_APROVADA if aprovar else AcaoAuditoria.SOLICITACAO_RECUSADA,
        admin,
        solicitacao,
        ip,
    )
    try:
        sessao.commit()
    except IntegrityError as erro:  # outra conta ficou com o valor no mesmo instante
        sessao.rollback()
        raise erro_em_uso from erro
    sessao.expire(usuario, ["solicitacoes"])
    return solicitacao

import math
import re
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import obter_configuracoes
from app.core.erros import ErroApi
from app.core.seguranca import (
    gerar_hash_senha,
    ler_token,
    normalizar_email,
    verificar_senha,
    verificar_senha_falsa,
)
from app.entities import PerfilUsuario, StatusUsuario, Usuario
from app.repositories import usuarios as repositorio_usuarios
from app.schemas.autenticacao import CadastroEntrada
from app.schemas.comum import CAMPOS_ENDERECO
from app.services import auditoria, foto_conta, verificacao_email
from app.services.auditoria import AcaoAuditoria
from app.services.email import Email

MENSAGEM_CREDENCIAIS_INVALIDAS = "Email, CPF ou senha incorretos."
MENSAGEM_EMAIL_JA_CADASTRADO = "Este email já está cadastrado. Faça login ou recupere sua senha."
MENSAGEM_CPF_JA_CADASTRADO = "Este CPF já está cadastrado. Faça login ou recupere sua senha."


def _credenciais_invalidas() -> ErroApi:
    return ErroApi(
        status.HTTP_401_UNAUTHORIZED, "CREDENCIAIS_INVALIDAS", MENSAGEM_CREDENCIAIS_INVALIDAS
    )


def _conta_bloqueada(segundos: float) -> ErroApi:
    return ErroApi(
        status.HTTP_423_LOCKED,
        "CONTA_BLOQUEADA",
        "Muitas tentativas. Aguarde para tentar novamente.",
        segundos_restantes=max(1, math.ceil(segundos)),
    )


_CPF_DIGITADO = re.compile(r"[\d.\-\s]+")


def buscar_por_login(sessao: Session, login: str) -> Usuario | None:
    """Conta pelo email ou pelo CPF (com ou sem pontuação). Usado no login e na recuperação."""
    login = login.strip()
    if "@" in login:
        return repositorio_usuarios.buscar_por_email(sessao, normalizar_email(login))
    if _CPF_DIGITADO.fullmatch(login):
        digitos = re.sub(r"\D", "", login)
        if len(digitos) == 11:
            return repositorio_usuarios.buscar_por_cpf(sessao, digitos)
    return None


def autenticar(
    sessao: Session, login: str, senha: str, ip: str | None, agora: datetime | None = None
) -> Usuario:
    """Regras de login da seção 3.1. Cada tentativa gera auditoria."""
    configuracoes = obter_configuracoes()
    agora = agora or datetime.now(UTC)

    def falhar(erro: ErroApi, acao: str, usuario: Usuario | None, motivo: str) -> ErroApi:
        auditoria.registrar(
            sessao,
            acao,
            usuario_id=usuario.id if usuario else None,
            entidade="usuario" if usuario else None,
            entidade_id=usuario.id if usuario else None,
            detalhes={"motivo": motivo},
            ip=ip,
        )
        sessao.commit()
        return erro

    usuario = buscar_por_login(sessao, login)
    if usuario is None:
        verificar_senha_falsa(senha)
        raise falhar(
            _credenciais_invalidas(), AcaoAuditoria.LOGIN_FALHA, None, "EMAIL_DESCONHECIDO"
        )

    if usuario.bloqueado_ate is not None and usuario.bloqueado_ate > agora:
        restante = (usuario.bloqueado_ate - agora).total_seconds()
        raise falhar(
            _conta_bloqueada(restante), AcaoAuditoria.LOGIN_FALHA, usuario, "CONTA_BLOQUEADA"
        )

    if not verificar_senha(senha, usuario.senha_hash):
        usuario.tentativas_falhas += 1
        if usuario.tentativas_falhas >= configuracoes.MAX_TENTATIVAS_LOGIN:
            usuario.bloqueado_ate = agora + timedelta(minutes=configuracoes.MINUTOS_BLOQUEIO)
            usuario.tentativas_falhas = 0
            raise falhar(
                _conta_bloqueada(configuracoes.MINUTOS_BLOQUEIO * 60),
                AcaoAuditoria.LOGIN_BLOQUEIO,
                usuario,
                "TENTATIVAS_ESGOTADAS",
            )
        raise falhar(
            _credenciais_invalidas(), AcaoAuditoria.LOGIN_FALHA, usuario, "SENHA_INCORRETA"
        )

    usuario.tentativas_falhas = 0
    usuario.bloqueado_ate = None

    if usuario.email_verificado_em is None:
        raise falhar(
            ErroApi(
                status.HTTP_403_FORBIDDEN,
                "EMAIL_NAO_VERIFICADO",
                "Confirme seu email para continuar. "
                "Enviamos um link de confirmação quando você se cadastrou.",
            ),
            AcaoAuditoria.LOGIN_FALHA,
            usuario,
            "EMAIL_NAO_VERIFICADO",
        )
    if usuario.status == StatusUsuario.PENDENTE:
        raise falhar(
            ErroApi(
                status.HTTP_403_FORBIDDEN,
                "CONTA_PENDENTE",
                "Seu cadastro ainda está em análise. "
                "Uma pessoa administradora vai liberar seu acesso.",
            ),
            AcaoAuditoria.LOGIN_FALHA,
            usuario,
            "CONTA_PENDENTE",
        )
    if usuario.status == StatusUsuario.INATIVO:
        raise falhar(
            ErroApi(
                status.HTTP_403_FORBIDDEN,
                "CONTA_INATIVA",
                "Sua conta está inativa. Fale com uma pessoa administradora.",
            ),
            AcaoAuditoria.LOGIN_FALHA,
            usuario,
            "CONTA_INATIVA",
        )

    auditoria.registrar(
        sessao,
        AcaoAuditoria.LOGIN_SUCESSO,
        usuario_id=usuario.id,
        entidade="usuario",
        entidade_id=usuario.id,
        ip=ip,
    )
    sessao.commit()
    return usuario


def usuario_do_refresh(sessao: Session, refresh_token: str | None) -> Usuario:
    """Valida o refresh token. Contas que não estejam ATIVO são recusadas (seção 3.2)."""
    usuario_id = ler_token(refresh_token, "refresh") if refresh_token else None
    usuario = repositorio_usuarios.buscar_por_id(sessao, usuario_id) if usuario_id else None
    if usuario is None or usuario.status != StatusUsuario.ATIVO:
        raise ErroApi(
            status.HTTP_401_UNAUTHORIZED, "TOKEN_INVALIDO", "Sua sessão expirou. Entre novamente."
        )
    return usuario


def _ja_cadastrado(campos: list[str]) -> ErroApi:
    mensagens = {"email": MENSAGEM_EMAIL_JA_CADASTRADO, "cpf": MENSAGEM_CPF_JA_CADASTRADO}
    return ErroApi(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "VALIDACAO",
        "Dados inválidos.",
        campos=[{"campo": campo, "mensagem": mensagens[campo]} for campo in campos],
    )


def _campos_ja_cadastrados(sessao: Session, dados: CadastroEntrada) -> list[str]:
    campos = []
    if repositorio_usuarios.buscar_por_email(sessao, dados.email) is not None:
        campos.append("email")
    if repositorio_usuarios.buscar_por_cpf(sessao, dados.cpf) is not None:
        campos.append("cpf")
    return campos


def cadastrar(sessao: Session, dados: CadastroEntrada, foto: bytes) -> tuple[Usuario, Email]:
    """Cria a conta (PADRAO, PENDENTE, email não confirmado, com foto) e o email de confirmação."""
    if repetidos := _campos_ja_cadastrados(sessao, dados):
        raise _ja_cadastrado(repetidos)
    foto_id: uuid.UUID = foto_conta.salvar(foto, "foto")
    try:
        usuario = repositorio_usuarios.adicionar(
            sessao,
            Usuario(
                nome=dados.nome,
                sobrenome=dados.sobrenome,
                cpf=dados.cpf,
                email=dados.email,
                telefone=dados.telefone,
                senha_hash=gerar_hash_senha(dados.senha),
                perfil=PerfilUsuario.PADRAO,
                status=StatusUsuario.PENDENTE,
                foto_id=foto_id,
                **{campo: getattr(dados, campo) for campo in CAMPOS_ENDERECO},
            ),
        )
        email = verificacao_email.gerar_email(sessao, usuario)
        sessao.commit()
    except IntegrityError as erro:  # cadastro simultâneo com o mesmo email ou CPF
        sessao.rollback()
        foto_conta.apagar(foto_id)
        raise _ja_cadastrado(_campos_ja_cadastrados(sessao, dados) or ["email"]) from erro
    except Exception:
        sessao.rollback()
        foto_conta.apagar(foto_id)
        raise
    return usuario, email

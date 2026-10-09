from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Cookie,
    Depends,
    Form,
    Query,
    Request,
    Response,
    status,
)
from sqlalchemy.orm import Session

from app.controllers import autenticacao as controller
from app.core.limite import LIMITE_AUTH, limiter
from app.core.permissoes import ip_da_requisicao, obter_usuario_atual
from app.db.sessao import obter_sessao
from app.entities import Usuario
from app.schemas.autenticacao import (
    CadastroFormulario,
    EmailEntrada,
    LoginEntrada,
    MensagemSaida,
    RecuperarSenhaEntrada,
    RedefinirSenhaEntrada,
    SessaoSaida,
    TokenEntrada,
    UsuarioSaida,
    ValidacaoTokenSaida,
)
from app.services.email import EnviadorEmail, obter_enviador_email
from app.services.fotos import ler_arquivo

router = APIRouter(prefix="/auth", tags=["autenticacao"])

SessaoBanco = Annotated[Session, Depends(obter_sessao)]


@router.post("/login", response_model=SessaoSaida)
@limiter.limit(LIMITE_AUTH)
def login(
    request: Request, response: Response, dados: LoginEntrada, sessao: SessaoBanco
) -> SessaoSaida:
    return controller.entrar(sessao, dados, ip_da_requisicao(request), response)


@router.post("/refresh", response_model=SessaoSaida)
@limiter.limit(LIMITE_AUTH)
def refresh(
    request: Request,
    response: Response,
    sessao: SessaoBanco,
    aurora_refresh: Annotated[str | None, Cookie()] = None,
) -> SessaoSaida:
    return controller.renovar(sessao, aurora_refresh, response)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    controller.sair(response)


@router.post("/cadastro", response_model=MensagemSaida, status_code=status.HTTP_201_CREATED)
@limiter.limit(LIMITE_AUTH)
def cadastro(
    request: Request,
    dados: Annotated[CadastroFormulario, Form()],
    tarefas: BackgroundTasks,
    sessao: SessaoBanco,
    enviador: Annotated[EnviadorEmail, Depends(obter_enviador_email)],
) -> MensagemSaida:
    """Formulário multipart: os campos do cadastro e a foto da conta (obrigatória)."""
    foto = ler_arquivo(dados.foto.file, "foto")
    return controller.cadastrar(sessao, dados, foto, tarefas, enviador)


@router.post("/verificar-email", response_model=MensagemSaida)
@limiter.limit(LIMITE_AUTH)
def verificar_email(request: Request, dados: TokenEntrada, sessao: SessaoBanco) -> MensagemSaida:
    return controller.verificar_email(sessao, dados, ip_da_requisicao(request))


@router.post("/confirmar-novo-email", response_model=MensagemSaida)
@limiter.limit(LIMITE_AUTH)
def confirmar_novo_email(
    request: Request, dados: TokenEntrada, sessao: SessaoBanco
) -> MensagemSaida:
    return controller.confirmar_troca_email(sessao, dados, ip_da_requisicao(request))


@router.post("/reenviar-verificacao", response_model=MensagemSaida)
@limiter.limit(LIMITE_AUTH)
def reenviar_verificacao(
    request: Request,
    dados: EmailEntrada,
    tarefas: BackgroundTasks,
    sessao: SessaoBanco,
    enviador: Annotated[EnviadorEmail, Depends(obter_enviador_email)],
) -> MensagemSaida:
    return controller.reenviar_verificacao(sessao, dados, tarefas, enviador)


@router.post("/recuperar-senha", response_model=MensagemSaida)
@limiter.limit(LIMITE_AUTH)
def recuperar_senha(
    request: Request,
    dados: RecuperarSenhaEntrada,
    tarefas: BackgroundTasks,
    sessao: SessaoBanco,
    enviador: Annotated[EnviadorEmail, Depends(obter_enviador_email)],
) -> MensagemSaida:
    return controller.solicitar_recuperacao(sessao, dados, tarefas, enviador)


@router.get("/redefinir-senha/validar", response_model=ValidacaoTokenSaida)
@limiter.limit(LIMITE_AUTH)
def validar_token_redefinicao(
    request: Request, sessao: SessaoBanco, token: Annotated[str, Query(max_length=128)]
) -> ValidacaoTokenSaida:
    return controller.validar_token(sessao, token)


@router.post("/redefinir-senha", response_model=MensagemSaida)
@limiter.limit(LIMITE_AUTH)
def redefinir_senha(
    request: Request, dados: RedefinirSenhaEntrada, sessao: SessaoBanco
) -> MensagemSaida:
    return controller.redefinir_senha(sessao, dados)


@router.get("/me", response_model=UsuarioSaida)
def me(usuario: Annotated[Usuario, Depends(obter_usuario_atual)]) -> Usuario:
    return usuario

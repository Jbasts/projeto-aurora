import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.controllers import usuarios as controller
from app.core.limite import LIMITE_AUTH, limiter
from app.core.permissoes import exigir_perfil, ip_da_requisicao, obter_usuario_atual
from app.db.sessao import obter_sessao
from app.entities import PerfilUsuario, StatusUsuario, TipoSolicitacao, Usuario
from app.schemas.autenticacao import MensagemSaida, UsuarioSaida
from app.schemas.comum import TAMANHO_PAGINA_MAXIMO, TAMANHO_PAGINA_PADRAO
from app.schemas.usuarios import (
    AlterarUsuarioEntrada,
    CompletarDadosEntrada,
    MeuPerfilEntrada,
    PaginaUsuarios,
    PedidoAlteracaoEntrada,
    TrocarSenhaEntrada,
    UsuarioDetalheSaida,
    UsuarioGestaoSaida,
)
from app.services.arquivos import Variante
from app.services.email import EnviadorEmail, obter_enviador_email
from app.services.fotos import ler_arquivo

SessaoBanco = Annotated[Session, Depends(obter_sessao)]
UsuarioLogado = Annotated[Usuario, Depends(obter_usuario_atual)]
Admin = Annotated[Usuario, Depends(exigir_perfil(PerfilUsuario.ADMIN))]

# --- Gestão de usuários (somente ADMIN, seção 3.5) ---

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("", response_model=PaginaUsuarios)
def listar(
    _: Admin,
    sessao: SessaoBanco,
    busca: Annotated[str | None, Query(max_length=150)] = None,
    perfil: PerfilUsuario | None = None,
    status: StatusUsuario | None = None,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanho: Annotated[int, Query(ge=1, le=TAMANHO_PAGINA_MAXIMO)] = TAMANHO_PAGINA_PADRAO,
) -> PaginaUsuarios:
    return controller.listar(sessao, busca, perfil, status, pagina, tamanho)


@router.get("/{usuario_id}", response_model=UsuarioDetalheSaida)
def obter(
    request: Request, usuario_id: uuid.UUID, admin: Admin, sessao: SessaoBanco
) -> UsuarioDetalheSaida:
    return controller.obter(sessao, admin, usuario_id, ip_da_requisicao(request))


@router.patch("/{usuario_id}/dados", response_model=UsuarioDetalheSaida)
def completar_dados(
    request: Request,
    usuario_id: uuid.UUID,
    dados: CompletarDadosEntrada,
    admin: Admin,
    sessao: SessaoBanco,
) -> UsuarioDetalheSaida:
    """Sobrenome e CPF de contas antigas, só quando ainda estão vazios."""
    return controller.completar_dados(sessao, admin, usuario_id, dados, ip_da_requisicao(request))


@router.patch("/{usuario_id}", response_model=UsuarioGestaoSaida)
def alterar(
    request: Request,
    usuario_id: uuid.UUID,
    dados: AlterarUsuarioEntrada,
    admin: Admin,
    sessao: SessaoBanco,
) -> UsuarioGestaoSaida:
    return controller.alterar(sessao, admin, usuario_id, dados, ip_da_requisicao(request))


# --- Meu perfil (todas as pessoas logadas, seção 3.6) ---

router_me = APIRouter(prefix="/me", tags=["meu perfil"])


@router_me.patch("", response_model=UsuarioSaida)
def atualizar_meus_dados(
    request: Request, dados: MeuPerfilEntrada, usuario: UsuarioLogado, sessao: SessaoBanco
) -> UsuarioSaida:
    return controller.atualizar_meus_dados(sessao, usuario, dados, ip_da_requisicao(request))


@router_me.patch("/senha", response_model=MensagemSaida)
@limiter.limit(LIMITE_AUTH)  # a senha atual não pode ser descoberta por tentativa e erro
def trocar_senha(
    request: Request, dados: TrocarSenhaEntrada, usuario: UsuarioLogado, sessao: SessaoBanco
) -> MensagemSaida:
    return controller.trocar_senha(sessao, usuario, dados, ip_da_requisicao(request))


@router_me.put("/foto", response_model=UsuarioSaida)
def trocar_foto(
    request: Request,
    arquivo: Annotated[UploadFile, File()],
    usuario: UsuarioLogado,
    sessao: SessaoBanco,
) -> UsuarioSaida:
    return controller.trocar_foto(
        sessao, usuario, ler_arquivo(arquivo.file), ip_da_requisicao(request)
    )


@router_me.post("/pedido-alteracao", response_model=UsuarioSaida)
@limiter.limit(LIMITE_AUTH)  # pede a senha da conta
def pedir_alteracao(
    request: Request,
    dados: PedidoAlteracaoEntrada,
    usuario: UsuarioLogado,
    sessao: SessaoBanco,
    tarefas: BackgroundTasks,
    enviador: Annotated[EnviadorEmail, Depends(obter_enviador_email)],
) -> UsuarioSaida:
    """Novo email (confirmado pelo link enviado a ele) e/ou novo CPF (aprovado por ADMIN)."""
    return controller.pedir_alteracao(
        sessao, usuario, dados, ip_da_requisicao(request), tarefas, enviador
    )


@router_me.delete("/troca-email", response_model=UsuarioSaida)
def cancelar_troca_email(usuario: UsuarioLogado, sessao: SessaoBanco) -> UsuarioSaida:
    return controller.cancelar_solicitacao(sessao, usuario, TipoSolicitacao.EMAIL)


@router_me.delete("/troca-cpf", response_model=UsuarioSaida)
def cancelar_troca_cpf(usuario: UsuarioLogado, sessao: SessaoBanco) -> UsuarioSaida:
    return controller.cancelar_solicitacao(sessao, usuario, TipoSolicitacao.CPF)


# --- Foto das contas (URL assinada; sem Bearer, para funcionar em <img>) ---

router_arquivos = APIRouter(prefix="/arquivos/contas", tags=["arquivos"])


@router_arquivos.get("/{foto_id}", response_class=FileResponse)
def arquivo_foto(
    foto_id: uuid.UUID,
    sessao: SessaoBanco,
    exp: int,
    assinatura: Annotated[str, Query(max_length=128)],
    variante: Variante = "original",
) -> FileResponse:
    return controller.arquivo_foto(sessao, foto_id, variante, exp, assinatura)

import uuid

from fastapi import BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.erros import ErroApi
from app.entities import PerfilUsuario, StatusUsuario, TipoSolicitacao, Usuario
from app.repositories import usuarios as repositorio_usuarios
from app.schemas.autenticacao import MensagemSaida, UsuarioSaida
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
from app.services import arquivos as servico_arquivos
from app.services import foto_conta as servico_foto_conta
from app.services import meu_perfil as servico_meu_perfil
from app.services import solicitacoes as servico_solicitacoes
from app.services import usuarios as servico_usuarios
from app.services.arquivos import Variante
from app.services.email import EnviadorEmail, enviar_sem_falhar

MENSAGEM_SENHA_ALTERADA = "Senha alterada."


def listar(
    sessao: Session,
    busca: str | None,
    perfil: PerfilUsuario | None,
    status: StatusUsuario | None,
    pagina: int,
    tamanho: int,
) -> PaginaUsuarios:
    itens, total = repositorio_usuarios.listar(
        sessao,
        busca=busca.strip() if busca else None,
        perfil=perfil,
        status=status,
        pagina=pagina,
        tamanho=tamanho,
    )
    return PaginaUsuarios(
        itens=[UsuarioGestaoSaida.model_validate(u) for u in itens],
        total=total,
        pagina=pagina,
        tamanho=tamanho,
    )


def obter(
    sessao: Session, admin: Usuario, usuario_id: uuid.UUID, ip: str | None
) -> UsuarioDetalheSaida:
    return UsuarioDetalheSaida.model_validate(servico_usuarios.obter(sessao, admin, usuario_id, ip))


def completar_dados(
    sessao: Session,
    admin: Usuario,
    usuario_id: uuid.UUID,
    dados: CompletarDadosEntrada,
    ip: str | None,
) -> UsuarioDetalheSaida:
    usuario = servico_usuarios.completar_dados(sessao, admin, usuario_id, dados, ip)
    return UsuarioDetalheSaida.model_validate(usuario)


def alterar(
    sessao: Session,
    admin: Usuario,
    usuario_id: uuid.UUID,
    dados: AlterarUsuarioEntrada,
    ip: str | None,
) -> UsuarioGestaoSaida:
    usuario = servico_usuarios.alterar(sessao, admin, usuario_id, dados, ip)
    return UsuarioGestaoSaida.model_validate(usuario)


def atualizar_meus_dados(
    sessao: Session, usuario: Usuario, dados: MeuPerfilEntrada, ip: str | None
) -> UsuarioSaida:
    return UsuarioSaida.model_validate(
        servico_meu_perfil.atualizar_dados(sessao, usuario, dados, ip)
    )


def trocar_senha(
    sessao: Session, usuario: Usuario, dados: TrocarSenhaEntrada, ip: str | None
) -> MensagemSaida:
    servico_meu_perfil.trocar_senha(sessao, usuario, dados, ip)
    return MensagemSaida(mensagem=MENSAGEM_SENHA_ALTERADA)


def trocar_foto(sessao: Session, usuario: Usuario, dados: bytes, ip: str | None) -> UsuarioSaida:
    return UsuarioSaida.model_validate(servico_foto_conta.trocar(sessao, usuario, dados, ip))


def pedir_alteracao(
    sessao: Session,
    usuario: Usuario,
    dados: PedidoAlteracaoEntrada,
    ip: str | None,
    tarefas: BackgroundTasks,
    enviador: EnviadorEmail,
) -> UsuarioSaida:
    email = servico_meu_perfil.pedir_alteracao(sessao, usuario, dados, ip)
    if email is not None:
        tarefas.add_task(enviar_sem_falhar, enviador, email)
    return UsuarioSaida.model_validate(usuario)


def cancelar_solicitacao(sessao: Session, usuario: Usuario, tipo: TipoSolicitacao) -> UsuarioSaida:
    return UsuarioSaida.model_validate(servico_solicitacoes.cancelar(sessao, usuario, tipo))


def arquivo_foto(
    sessao: Session, foto_id: uuid.UUID, variante: Variante, expira: int, assinatura: str
) -> FileResponse:
    servico_arquivos.exigir_assinatura_valida(foto_id, variante, expira, assinatura, conta=True)
    caminho = servico_foto_conta.caminho_arquivo(foto_id, variante)
    # A foto precisa ser a atual de alguma conta: fotos substituídas não são mais servidas.
    if repositorio_usuarios.buscar_por_foto(sessao, foto_id) is None or not caminho.is_file():
        raise ErroApi(404, "NAO_ENCONTRADO", "Arquivo não encontrado.")
    return FileResponse(
        caminho,
        media_type="image/webp",
        headers={
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )

import uuid

from fastapi import UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.erros import ErroApi
from app.entities import Foto, Pessoa, TipoFoto, Usuario
from app.repositories import fotos as repositorio_fotos
from app.repositories import usuarios as repositorio_usuarios
from app.schemas.pessoas import (
    FotoSaida,
    InativarPessoaEntrada,
    PessoaCriacaoEntrada,
    PessoaEntrada,
    PessoaSaida,
    SugestaoPessoaSaida,
    UsuarioRef,
)
from app.services import arquivos as servico_arquivos
from app.services import fotos as servico_fotos
from app.services import pessoas as servico_pessoas
from app.services.arquivos import Variante


def _ref(nomes: dict[uuid.UUID, str], usuario_id: uuid.UUID | None) -> UsuarioRef | None:
    if usuario_id is None or usuario_id not in nomes:
        return None
    return UsuarioRef(id=usuario_id, nome=nomes[usuario_id])


def _foto_saida(foto: Foto, nomes: dict[uuid.UUID, str]) -> FotoSaida:
    return FotoSaida(
        id=foto.id,
        tipo=foto.tipo,
        legenda=foto.legenda,
        url=servico_arquivos.url_assinada(foto.id, "original"),
        url_miniatura=servico_arquivos.url_assinada(foto.id, "miniatura"),
        enviada_por=_ref(nomes, foto.enviada_por_id),
        criado_em=foto.criado_em,
    )


def _pessoa_saida(sessao: Session, pessoa: Pessoa) -> PessoaSaida:
    album = repositorio_fotos.album(sessao, pessoa.id)
    perfil = (
        repositorio_fotos.buscar_por_id(sessao, pessoa.foto_perfil_id)
        if pessoa.foto_perfil_id
        else None
    )
    ids = {pessoa.cadastrada_por_id, pessoa.inativada_por_id}
    ids |= {f.enviada_por_id for f in [*album, *([perfil] if perfil else [])]}
    nomes = repositorio_usuarios.nomes_por_id(sessao, {i for i in ids if i is not None})

    def _float(valor) -> float | None:
        return float(valor) if valor is not None else None

    return PessoaSaida(
        **{campo: getattr(pessoa, campo) for campo in servico_pessoas.CAMPOS_EDITAVEIS},
        id=pessoa.id,
        consentimento_em=pessoa.consentimento_em,
        status=pessoa.status,
        motivo_inativacao=pessoa.motivo_inativacao,
        inativada_em=pessoa.inativada_em,
        inativada_por=_ref(nomes, pessoa.inativada_por_id),
        cadastrada_por=_ref(nomes, pessoa.cadastrada_por_id),
        foto_perfil=_foto_saida(perfil, nomes) if perfil else None,
        album=[_foto_saida(f, nomes) for f in album],
        ultima_vez_visto=pessoa.ultima_vez_visto,
        ultima_latitude=_float(pessoa.ultima_latitude),
        ultima_longitude=_float(pessoa.ultima_longitude),
        ultimo_endereco=pessoa.ultimo_endereco,
        criado_em=pessoa.criado_em,
        atualizado_em=pessoa.atualizado_em,
    )


def sugestoes(sessao: Session, termo: str, usuario: Usuario) -> list[SugestaoPessoaSaida]:
    return [
        SugestaoPessoaSaida(
            id=pessoa.id,
            nome=pessoa.nome,
            sobrenome=pessoa.sobrenome,
            apelido=pessoa.apelido,
            status=pessoa.status,
            url_miniatura=servico_arquivos.url_assinada(foto.id, "miniatura") if foto else None,
        )
        for pessoa, foto in servico_pessoas.sugestoes(sessao, termo, usuario)
    ]


def cadastrar(
    sessao: Session, dados: PessoaCriacaoEntrada, usuario: Usuario, ip: str | None
) -> PessoaSaida:
    pessoa = servico_pessoas.cadastrar(sessao, dados, usuario, ip)
    return _pessoa_saida(sessao, pessoa)


def visualizar(
    sessao: Session, pessoa_id: uuid.UUID, usuario: Usuario, ip: str | None
) -> PessoaSaida:
    return _pessoa_saida(sessao, servico_pessoas.visualizar(sessao, pessoa_id, usuario, ip))


def atualizar(
    sessao: Session, pessoa_id: uuid.UUID, dados: PessoaEntrada, usuario: Usuario, ip: str | None
) -> PessoaSaida:
    return _pessoa_saida(sessao, servico_pessoas.atualizar(sessao, pessoa_id, dados, usuario, ip))


def inativar(
    sessao: Session,
    pessoa_id: uuid.UUID,
    dados: InativarPessoaEntrada,
    usuario: Usuario,
    ip: str | None,
) -> PessoaSaida:
    pessoa = servico_pessoas.inativar(sessao, pessoa_id, dados.motivo, usuario, ip)
    return _pessoa_saida(sessao, pessoa)


def reativar(
    sessao: Session, pessoa_id: uuid.UUID, usuario: Usuario, ip: str | None
) -> PessoaSaida:
    return _pessoa_saida(sessao, servico_pessoas.reativar(sessao, pessoa_id, usuario, ip))


async def _ler_envio(arquivo: UploadFile) -> bytes:
    # Lê no máximo 1 byte além do limite: arquivos enormes não ocupam a memória inteira.
    dados = await arquivo.read(servico_fotos.TAMANHO_MAXIMO_BYTES + 1)
    if len(dados) > servico_fotos.TAMANHO_MAXIMO_BYTES:
        raise servico_fotos.erro_foto(servico_fotos.MENSAGEM_TAMANHO)
    return dados


async def enviar_foto(
    sessao: Session,
    pessoa_id: uuid.UUID,
    tipo: TipoFoto,
    arquivo: UploadFile,
    legenda: str | None,
    usuario: Usuario,
    ip: str | None,
) -> FotoSaida:
    dados = await _ler_envio(arquivo)
    foto = servico_fotos.enviar(sessao, pessoa_id, tipo, dados, legenda, usuario, ip)
    nomes = repositorio_usuarios.nomes_por_id(sessao, {usuario.id})
    return _foto_saida(foto, nomes)


def remover_foto(
    sessao: Session, pessoa_id: uuid.UUID, foto_id: uuid.UUID, usuario: Usuario, ip: str | None
) -> None:
    servico_fotos.remover(sessao, pessoa_id, foto_id, usuario, ip)


def arquivo(
    sessao: Session, foto_id: uuid.UUID, variante: Variante, expira: int, assinatura: str
) -> FileResponse:
    servico_arquivos.exigir_assinatura_valida(foto_id, variante, expira, assinatura)
    foto = repositorio_fotos.buscar_por_id(sessao, foto_id)
    caminho = servico_fotos.caminho_arquivo(foto, variante) if foto else None
    if caminho is None or not caminho.is_file():
        raise ErroApi(404, "NAO_ENCONTRADO", "Arquivo não encontrado.")
    return FileResponse(
        caminho,
        media_type=foto.mime,
        headers={
            # Cache só no navegador de quem abriu, até a URL expirar.
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )

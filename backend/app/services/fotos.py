import uuid
from io import BytesIO
from pathlib import Path
from typing import BinaryIO

from fastapi import status
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.core.config import obter_configuracoes
from app.core.erros import ErroApi
from app.entities import Foto, Pessoa, TipoFoto, Usuario
from app.repositories import fotos as repositorio_fotos
from app.repositories import pessoas as repositorio_pessoas
from app.services import auditoria
from app.services.arquivos import Variante
from app.services.auditoria import AcaoAuditoria

TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024
FORMATOS_ACEITOS = {"JPEG", "PNG", "WEBP"}
LADO_MAXIMO = 1600
LADO_MINIATURA = 400
MAXIMO_FOTOS_ALBUM = 20
MAXIMO_PIXELS = 50_000_000  # protege contra "bombas" de descompressão
QUALIDADE_WEBP = 82
MIME_SALVO = "image/webp"

MENSAGEM_FORMATO = "Envie uma foto em JPG, PNG ou WEBP."
MENSAGEM_TAMANHO = "A foto deve ter no máximo 5 MB."

Image.MAX_IMAGE_PIXELS = MAXIMO_PIXELS


def erro_foto(mensagem: str, campo: str = "arquivo") -> ErroApi:
    return ErroApi(
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        "VALIDACAO",
        "Dados inválidos.",
        campos=[{"campo": campo, "mensagem": mensagem}],
    )


def _webp(imagem: Image.Image) -> bytes:
    saida = BytesIO()
    imagem.save(saida, "WEBP", quality=QUALIDADE_WEBP, method=4)
    return saida.getvalue()


def ler_arquivo(arquivo: BinaryIO, campo: str = "arquivo") -> bytes:
    """Lê no máximo 1 byte além do limite: arquivos enormes não ocupam a memória inteira."""
    dados = arquivo.read(TAMANHO_MAXIMO_BYTES + 1)
    if len(dados) > TAMANHO_MAXIMO_BYTES:
        raise erro_foto(MENSAGEM_TAMANHO, campo)
    return dados


def processar_imagem(dados: bytes, campo: str = "arquivo") -> tuple[bytes, bytes]:
    """Valida e devolve (foto até 1600 px, miniatura até 400 px), ambas em WEBP.

    Corrige a rotação pela orientação EXIF e descarta todos os metadados (EXIF tem GPS).
    `campo` é o nome do campo do formulário nos erros de validação.
    """
    if len(dados) > TAMANHO_MAXIMO_BYTES:
        raise erro_foto(MENSAGEM_TAMANHO, campo)
    try:
        imagem = Image.open(BytesIO(dados))
        formato = imagem.format
        if formato not in FORMATOS_ACEITOS:
            raise erro_foto(MENSAGEM_FORMATO, campo)
        if imagem.width * imagem.height > MAXIMO_PIXELS:
            raise erro_foto("A foto tem resolução grande demais.", campo)
        imagem = ImageOps.exif_transpose(imagem)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError) as erro:
        raise erro_foto(MENSAGEM_FORMATO, campo) from erro

    tem_transparencia = imagem.mode in ("RGBA", "LA", "PA") or "transparency" in imagem.info
    modo = "RGBA" if tem_transparencia else "RGB"
    convertida = imagem.convert(modo)
    # Imagem nova, só com os pixels: nenhum metadado da original (EXIF, GPS, XMP, ICC) passa.
    limpa = Image.new(modo, convertida.size)
    limpa.paste(convertida)

    foto = limpa.copy()
    foto.thumbnail((LADO_MAXIMO, LADO_MAXIMO), Image.Resampling.LANCZOS)
    miniatura = limpa.copy()
    miniatura.thumbnail((LADO_MINIATURA, LADO_MINIATURA), Image.Resampling.LANCZOS)
    return _webp(foto), _webp(miniatura)


# --- Arquivos em disco (UPLOAD_DIR nunca é servido diretamente) ---


def diretorio_uploads() -> Path:
    diretorio = Path(obter_configuracoes().UPLOAD_DIR)
    diretorio.mkdir(parents=True, exist_ok=True)
    return diretorio


def caminho_arquivo(foto: Foto, variante: Variante) -> Path:
    nome = foto.caminho_miniatura if variante == "miniatura" else foto.caminho
    return diretorio_uploads() / Path(nome).name


def apagar_arquivos(*nomes: str) -> None:
    for nome in nomes:
        (diretorio_uploads() / Path(nome).name).unlink(missing_ok=True)


# --- Regras ---


def _pessoa_para_alterar(sessao: Session, pessoa_id: uuid.UUID) -> Pessoa:
    pessoa = repositorio_pessoas.buscar_para_alterar(sessao, pessoa_id)
    if pessoa is None:
        raise ErroApi(status.HTTP_404_NOT_FOUND, "NAO_ENCONTRADO", "Pessoa não encontrada.")
    return pessoa


def enviar(
    sessao: Session,
    pessoa_id: uuid.UUID,
    tipo: TipoFoto,
    dados: bytes,
    legenda: str | None,
    usuario: Usuario,
    ip: str | None,
) -> Foto:
    """Foto de perfil (substitui a anterior) ou foto do álbum (até 20)."""
    pessoa = _pessoa_para_alterar(sessao, pessoa_id)
    if not pessoa.consentimento:
        raise ErroApi(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "SEM_CONSENTIMENTO",
            "Sem o consentimento da pessoa, não é possível enviar fotos.",
        )
    if (
        tipo == TipoFoto.ALBUM
        and repositorio_fotos.contar_album(sessao, pessoa.id) >= MAXIMO_FOTOS_ALBUM
    ):
        raise erro_foto(f"O álbum já tem {MAXIMO_FOTOS_ALBUM} fotos. Remova uma para enviar outra.")

    original, miniatura = processar_imagem(dados)
    foto_id = uuid.uuid4()
    nome, nome_miniatura = f"{foto_id}.webp", f"{foto_id}_miniatura.webp"
    diretorio = diretorio_uploads()
    (diretorio / nome).write_bytes(original)
    (diretorio / nome_miniatura).write_bytes(miniatura)

    anterior: Foto | None = None
    try:
        foto = repositorio_fotos.adicionar(
            sessao,
            Foto(
                id=foto_id,
                pessoa_id=pessoa.id,
                tipo=tipo,
                caminho=nome,
                caminho_miniatura=nome_miniatura,
                mime=MIME_SALVO,
                tamanho_bytes=len(original),
                legenda=legenda if tipo == TipoFoto.ALBUM else None,
                enviada_por_id=usuario.id,
            ),
        )
        if tipo == TipoFoto.PERFIL:
            if pessoa.foto_perfil_id is not None:
                anterior = repositorio_fotos.buscar_por_id(sessao, pessoa.foto_perfil_id)
            pessoa.foto_perfil_id = foto.id
            sessao.flush()
            if anterior is not None:
                repositorio_fotos.remover(sessao, anterior)
        auditoria.registrar(
            sessao,
            AcaoAuditoria.FOTO_ENVIADA,
            usuario_id=usuario.id,
            entidade="foto",
            entidade_id=foto.id,
            detalhes={"pessoa_id": str(pessoa.id), "tipo": tipo.value},
            ip=ip,
        )
        sessao.commit()
    except Exception:
        sessao.rollback()
        apagar_arquivos(nome, nome_miniatura)
        raise

    if anterior is not None:
        apagar_arquivos(anterior.caminho, anterior.caminho_miniatura)
    return foto


def remover(
    sessao: Session, pessoa_id: uuid.UUID, foto_id: uuid.UUID, usuario: Usuario, ip: str | None
) -> None:
    pessoa = _pessoa_para_alterar(sessao, pessoa_id)
    foto = repositorio_fotos.buscar_por_id(sessao, foto_id)
    if foto is None or foto.pessoa_id != pessoa.id:
        raise ErroApi(status.HTTP_404_NOT_FOUND, "NAO_ENCONTRADO", "Foto não encontrada.")

    if pessoa.foto_perfil_id == foto.id:
        pessoa.foto_perfil_id = None
        sessao.flush()
    caminhos = (foto.caminho, foto.caminho_miniatura)
    repositorio_fotos.remover(sessao, foto)
    auditoria.registrar(
        sessao,
        AcaoAuditoria.FOTO_REMOVIDA,
        usuario_id=usuario.id,
        entidade="foto",
        entidade_id=foto_id,
        detalhes={"pessoa_id": str(pessoa.id), "tipo": foto.tipo.value},
        ip=ip,
    )
    sessao.commit()
    # Só apaga do disco depois que o banco confirmou.
    apagar_arquivos(*caminhos)

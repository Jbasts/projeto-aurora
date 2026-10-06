from sqlalchemy.orm import Session

from app.entities import Usuario
from app.repositories import pessoas as repositorio_pessoas
from app.repositories import usuarios as repositorio_usuarios
from app.schemas.mapa import AvistamentoEntrada, AvistamentoSaida, EnderecoSaida, MarcadorSaida
from app.schemas.pessoas import UsuarioRef
from app.services import arquivos as servico_arquivos
from app.services import avistamentos as servico_avistamentos
from app.services.geocodificacao import Geocodificador


def marcadores(sessao: Session) -> list[MarcadorSaida]:
    return [
        MarcadorSaida(
            id=pessoa.id,
            nome=pessoa.nome,
            sobrenome=pessoa.sobrenome,
            apelido=pessoa.apelido,
            idade_aproximada=pessoa.idade_aproximada,
            url_miniatura=servico_arquivos.url_assinada(foto.id, "miniatura") if foto else None,
            latitude=float(pessoa.ultima_latitude),
            longitude=float(pessoa.ultima_longitude),
            ultimo_endereco=pessoa.ultimo_endereco,
            ultima_vez_visto=pessoa.ultima_vez_visto,
        )
        for pessoa, foto in repositorio_pessoas.marcadores(sessao)
    ]


def registrar_avistamento(
    sessao: Session,
    dados: AvistamentoEntrada,
    usuario: Usuario,
    ip: str | None,
    geocodificador: Geocodificador,
) -> AvistamentoSaida:
    # Endereço buscado antes da transação: a consulta externa não segura o banco.
    endereco = geocodificador.endereco(dados.latitude, dados.longitude)
    avistamento, mais_recente = servico_avistamentos.registrar_para_pessoa(
        sessao,
        dados.pessoa_id,
        latitude=dados.latitude,
        longitude=dados.longitude,
        visto_em=dados.visto_em,
        observacao=dados.observacao,
        endereco=endereco,
        usuario=usuario,
        ip=ip,
    )
    nomes = repositorio_usuarios.nomes_por_id(sessao, {usuario.id})
    return AvistamentoSaida(
        id=avistamento.id,
        pessoa_id=avistamento.pessoa_id,
        latitude=float(avistamento.latitude),
        longitude=float(avistamento.longitude),
        endereco=avistamento.endereco,
        visto_em=avistamento.visto_em,
        observacao=avistamento.observacao,
        registrado_por=UsuarioRef(id=usuario.id, nome=nomes.get(usuario.id, usuario.nome)),
        criado_em=avistamento.criado_em,
        mais_recente=mais_recente,
    )


def endereco(latitude: float, longitude: float, geocodificador: Geocodificador) -> EnderecoSaida:
    return EnderecoSaida(endereco=geocodificador.endereco(latitude, longitude))

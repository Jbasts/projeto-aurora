from datetime import UTC, datetime, timedelta

import pytest

from app.core.seguranca import criar_token
from app.entities import PerfilUsuario, Pessoa, StatusPessoa

PESSOAS = "/api/v1/pessoas"
AGORA = datetime.now(UTC)


def cabecalho(usuario) -> dict[str, str]:
    return {"Authorization": f"Bearer {criar_token(usuario.id, 'access')}"}


@pytest.fixture
def colaborador(criar_usuario):
    return criar_usuario(email="colab@exemplo.com", nome="Colab Teste")


@pytest.fixture
def padrao(criar_usuario):
    return criar_usuario(email="padrao@exemplo.com", perfil=PerfilUsuario.PADRAO)


@pytest.fixture
def pessoas(sessao, colaborador):
    """Cinco pessoas com nomes, status e datas de avistamento variados."""
    dados = [
        ("Ângela", "Souza", "Anjinha", StatusPessoa.ATIVA, 2),
        ("bruno", "Lima", None, StatusPessoa.ATIVA, 40),
        ("Carla", "Mendes", "Carlinha", StatusPessoa.INATIVA, 5),
        ("Daniel", "Conceição", "Dani", StatusPessoa.ATIVA, None),
        ("Érica", "Alves", None, StatusPessoa.ATIVA, 100),
    ]
    criadas = {}
    for nome, sobrenome, apelido, status, dias in dados:
        pessoa = Pessoa(
            nome=nome,
            sobrenome=sobrenome,
            apelido=apelido,
            status=status,
            consentimento=False,
            cadastrada_por_id=colaborador.id,
            ultima_vez_visto=AGORA - timedelta(days=dias) if dias is not None else None,
        )
        sessao.add(pessoa)
        criadas[nome] = pessoa
    sessao.flush()
    return criadas


def nomes(resposta) -> list[str]:
    return [p["nome"] for p in resposta.json()["itens"]]


def buscar(cliente, usuario, **params):
    return cliente.get(PESSOAS, params=params, headers=cabecalho(usuario))


def test_ordena_por_nome_ignorando_acento_e_maiuscula(cliente, colaborador, pessoas):
    resposta = buscar(cliente, colaborador, tamanho=10)
    assert nomes(resposta) == ["Ângela", "bruno", "Carla", "Daniel", "Érica"]
    assert resposta.json()["total"] == 5


def test_padrao_de_cinco_por_pagina(cliente, colaborador, pessoas, sessao):
    sessao.add(
        Pessoa(nome="Zé", sobrenome="X", consentimento=False, cadastrada_por_id=colaborador.id)
    )
    sessao.flush()
    corpo = buscar(cliente, colaborador).json()
    assert (corpo["tamanho"], len(corpo["itens"]), corpo["total"]) == (5, 5, 6)
    segunda = buscar(cliente, colaborador, pagina=2).json()
    assert [p["nome"] for p in segunda["itens"]] == ["Zé"]


def test_ordena_por_visto_por_ultimo_com_sem_registro_no_fim(cliente, colaborador, pessoas):
    resposta = buscar(cliente, colaborador, ordem="visto")
    assert nomes(resposta) == ["Ângela", "Carla", "bruno", "Érica", "Daniel"]


@pytest.mark.parametrize(
    ("termo", "esperado"),
    [
        ("angela", ["Ângela"]),
        ("CONCEICAO", ["Daniel"]),
        ("carlinha", ["Carla"]),
        ("Mendez", ["Carla"]),  # erro de digitação
    ],
)
def test_busca_por_nome_sobrenome_ou_apelido(cliente, colaborador, pessoas, termo, esperado):
    assert nomes(buscar(cliente, colaborador, busca=termo)) == esperado


def test_filtro_visto_desde(cliente, colaborador, pessoas):
    desde = (AGORA - timedelta(days=30)).isoformat()
    assert nomes(buscar(cliente, colaborador, visto_desde=desde)) == ["Ângela", "Carla"]


def test_filtro_status_para_gestores(cliente, colaborador, pessoas):
    assert nomes(buscar(cliente, colaborador, status="INATIVA")) == ["Carla"]
    assert "Carla" not in nomes(buscar(cliente, colaborador, status="ATIVA"))


def test_pessoa_usuaria_so_ve_ativas_mesmo_pedindo_inativas(cliente, padrao, pessoas):
    assert nomes(buscar(cliente, padrao, tamanho=10)) == ["Ângela", "bruno", "Daniel", "Érica"]
    assert nomes(buscar(cliente, padrao, status="INATIVA")) == []
    assert buscar(cliente, padrao, busca="carlinha").json()["total"] == 0


def test_formato_da_linha(cliente, colaborador, pessoas):
    linha = buscar(cliente, colaborador, busca="angela").json()["itens"][0]
    assert linha["apelido"] == "Anjinha"
    assert linha["status"] == "ATIVA"
    assert linha["url_miniatura"] is None
    assert linha["cadastrada_por"]["nome"] == "Colab Teste"
    assert linha["ultima_vez_visto"] is not None
    assert set(linha) == {
        "id",
        "nome",
        "sobrenome",
        "apelido",
        "status",
        "url_miniatura",
        "ultima_vez_visto",
        "ultimo_endereco",
        "ultima_latitude",
        "ultima_longitude",
        "cadastrada_por",
    }


@pytest.mark.parametrize(
    "params", [{"ordem": "idade"}, {"tamanho": 101}, {"pagina": 0}, {"status": "X"}]
)
def test_parametros_invalidos(cliente, colaborador, params):
    assert buscar(cliente, colaborador, **params).status_code == 422


def test_sem_login(cliente):
    assert cliente.get(PESSOAS).status_code == 401

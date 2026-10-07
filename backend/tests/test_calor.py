from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.core.seguranca import criar_token
from app.entities import Avistamento, LogAuditoria, PerfilUsuario, Pessoa, StatusPessoa

CALOR = "/api/v1/mapa/calor"
AGORA = datetime.now(UTC)


def cabecalho(usuario) -> dict[str, str]:
    return {"Authorization": f"Bearer {criar_token(usuario.id, 'access')}"}


def historico_url(pessoa) -> str:
    return f"/api/v1/pessoas/{pessoa.id}/avistamentos"


@pytest.fixture
def colaborador(criar_usuario):
    return criar_usuario(email="colab@exemplo.com", nome="Colab Teste")


@pytest.fixture
def padrao(criar_usuario):
    return criar_usuario(email="padrao@exemplo.com", perfil=PerfilUsuario.PADRAO)


@pytest.fixture
def criar_pessoa(sessao, colaborador):
    def criar(nome="Ana", status=StatusPessoa.ATIVA):
        pessoa = Pessoa(
            nome=nome,
            sobrenome="Teste",
            consentimento=False,
            status=status,
            cadastrada_por_id=colaborador.id,
        )
        sessao.add(pessoa)
        sessao.flush()
        return pessoa

    return criar


@pytest.fixture
def avistar(sessao, colaborador):
    def avistar(pessoa, lat="-22.505000", lng="-43.179000", dias=0.0, usuario=None, **extras):
        avistamento = Avistamento(
            pessoa_id=pessoa.id,
            latitude=Decimal(lat),
            longitude=Decimal(lng),
            visto_em=AGORA - timedelta(days=dias),
            registrado_por_id=(usuario or colaborador).id,
            **extras,
        )
        sessao.add(avistamento)
        sessao.flush()
        return avistamento

    return avistar


# --- Mapa de calor (seção 3.10) ---


class TestCalor:
    def test_soma_avistamentos_no_mesmo_ponto_e_ignora_inativas(
        self, cliente, padrao, criar_pessoa, avistar
    ):
        ana, bia = criar_pessoa("Ana"), criar_pessoa("Bia")
        inativa = criar_pessoa("Caio", status=StatusPessoa.INATIVA)
        avistar(ana)
        avistar(bia)
        avistar(ana, lat="-22.510000", lng="-43.180000")
        avistar(inativa, lat="-22.600000", lng="-43.200000")

        resposta = cliente.get(CALOR, headers=cabecalho(padrao))
        assert resposta.status_code == 200
        assert sorted(resposta.json()) == [[-22.51, -43.18, 1], [-22.505, -43.179, 2]]

    def test_filtra_por_periodo(self, cliente, padrao, criar_pessoa, avistar):
        ana = criar_pessoa()
        avistar(ana, dias=1)
        avistar(ana, lat="-22.510000", lng="-43.180000", dias=40)
        de = (AGORA - timedelta(days=30)).isoformat()

        corpo = cliente.get(CALOR, params={"de": de}, headers=cabecalho(padrao)).json()
        assert corpo == [[-22.505, -43.179, 1]]

        ate = (AGORA - timedelta(days=30)).isoformat()
        corpo = cliente.get(CALOR, params={"ate": ate}, headers=cabecalho(padrao)).json()
        assert corpo == [[-22.51, -43.18, 1]]

    def test_periodo_invertido(self, cliente, padrao):
        resposta = cliente.get(
            CALOR,
            params={"de": AGORA.isoformat(), "ate": (AGORA - timedelta(days=1)).isoformat()},
            headers=cabecalho(padrao),
        )
        assert resposta.status_code == 422
        assert resposta.json()["codigo"] == "VALIDACAO"

    def test_filtra_por_pessoa(self, cliente, padrao, criar_pessoa, avistar):
        ana, bia = criar_pessoa("Ana"), criar_pessoa("Bia")
        avistar(ana)
        avistar(bia, lat="-22.510000", lng="-43.180000")
        corpo = cliente.get(
            CALOR, params={"pessoa_id": str(bia.id)}, headers=cabecalho(padrao)
        ).json()
        assert corpo == [[-22.51, -43.18, 1]]

    def test_pessoa_inativa_so_para_gestores(
        self, cliente, padrao, colaborador, criar_pessoa, avistar
    ):
        inativa = criar_pessoa(status=StatusPessoa.INATIVA)
        avistar(inativa)
        params = {"pessoa_id": str(inativa.id)}
        assert cliente.get(CALOR, params=params, headers=cabecalho(padrao)).status_code == 404
        resposta = cliente.get(CALOR, params=params, headers=cabecalho(colaborador))
        assert resposta.json() == [[-22.505, -43.179, 1]]

    def test_sem_login(self, cliente):
        assert cliente.get(CALOR).status_code == 401


# --- Histórico de avistamentos no perfil ---


class TestHistorico:
    def test_paginado_do_mais_recente_com_quem_registrou(
        self, cliente, padrao, criar_usuario, criar_pessoa, avistar, sessao
    ):
        admin = criar_usuario(email="adm@exemplo.com", nome="Adm", perfil=PerfilUsuario.ADMIN)
        ana = criar_pessoa()
        for dias in range(7):
            avistar(ana, dias=dias, observacao=f"dia {dias}")
        avistar(ana, dias=0.5, usuario=admin, endereco="Praça da Liberdade")
        avistar(criar_pessoa("Bia"))
        logs_antes = sessao.scalar(select(func.count()).select_from(LogAuditoria))

        resposta = cliente.get(historico_url(ana), headers=cabecalho(padrao))
        assert resposta.status_code == 200
        corpo = resposta.json()
        assert (corpo["total"], corpo["pagina"], corpo["tamanho"]) == (8, 1, 5)
        assert [i["observacao"] for i in corpo["itens"]] == [
            "dia 0",
            None,
            "dia 1",
            "dia 2",
            "dia 3",
        ]
        segundo = corpo["itens"][1]
        assert segundo["endereco"] == "Praça da Liberdade"
        assert segundo["registrado_por"] == {"id": str(admin.id), "nome": "Adm", "perfil": "ADMIN"}
        assert corpo["itens"][0]["registrado_por"]["perfil"] == "COLABORADOR"

        pagina2 = cliente.get(
            historico_url(ana), params={"pagina": 2}, headers=cabecalho(padrao)
        ).json()
        assert [i["observacao"] for i in pagina2["itens"]] == ["dia 4", "dia 5", "dia 6"]
        # Só a visualização do perfil gera auditoria, não o histórico.
        assert sessao.scalar(select(func.count()).select_from(LogAuditoria)) == logs_antes

    def test_pessoa_inativa_so_para_gestores(self, cliente, padrao, colaborador, criar_pessoa):
        inativa = criar_pessoa(status=StatusPessoa.INATIVA)
        assert cliente.get(historico_url(inativa), headers=cabecalho(padrao)).status_code == 404
        assert (
            cliente.get(historico_url(inativa), headers=cabecalho(colaborador)).json()["total"] == 0
        )

    def test_tamanho_maximo(self, cliente, padrao, criar_pessoa):
        resposta = cliente.get(
            historico_url(criar_pessoa()), params={"tamanho": 101}, headers=cabecalho(padrao)
        )
        assert resposta.status_code == 422

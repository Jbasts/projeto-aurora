from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest
from sqlalchemy import select

from app.core.seguranca import criar_token
from app.entities import Avistamento, LogAuditoria, PerfilUsuario, Pessoa, StatusPessoa
from app.services.geocodificacao import GeocodificadorNominatim, formatar_endereco

MARCADORES = "/api/v1/mapa/marcadores"
AVISTAMENTOS = "/api/v1/avistamentos"
GEO = "/api/v1/geocodificacao/reversa"
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
def criar_pessoa(sessao, colaborador):
    def criar(nome="Ana", status=StatusPessoa.ATIVA, visto_ha_horas: float | None = 5):
        pessoa = Pessoa(
            nome=nome,
            sobrenome="Teste",
            consentimento=False,
            status=status,
            cadastrada_por_id=colaborador.id,
        )
        if visto_ha_horas is not None:
            pessoa.ultima_vez_visto = AGORA - timedelta(hours=visto_ha_horas)
            pessoa.ultima_latitude = Decimal("-22.505000")
            pessoa.ultima_longitude = Decimal("-43.179000")
            pessoa.ultimo_endereco = "Praça da Liberdade"
        sessao.add(pessoa)
        sessao.flush()
        return pessoa

    return criar


def dados_avistamento(pessoa, **extras) -> dict:
    return {
        "pessoa_id": str(pessoa.id),
        "latitude": -22.51,
        "longitude": -43.18,
        "visto_em": AGORA.isoformat(),
        **extras,
    }


# --- Marcadores (seção 3.9) ---


class TestMarcadores:
    def test_so_ativas_com_localizacao(self, cliente, padrao, criar_pessoa):
        criar_pessoa("Ana")
        criar_pessoa("Bia", status=StatusPessoa.INATIVA)
        criar_pessoa("Caio", visto_ha_horas=None)
        resposta = cliente.get(MARCADORES, headers=cabecalho(padrao))
        assert resposta.status_code == 200
        corpo = resposta.json()
        assert [m["nome"] for m in corpo] == ["Ana"]
        assert corpo[0]["latitude"] == -22.505
        assert corpo[0]["ultimo_endereco"] == "Praça da Liberdade"
        assert corpo[0]["url_miniatura"] is None
        assert corpo[0]["registrado_por"] is None

    def test_mostra_quem_registrou_o_ultimo_avistamento(
        self, cliente, padrao, colaborador, criar_usuario, criar_pessoa, sessao
    ):
        admin = criar_usuario(email="adm@exemplo.com", nome="Adm Teste", perfil=PerfilUsuario.ADMIN)
        pessoa = criar_pessoa(visto_ha_horas=1)
        for usuario, horas in [(admin, 1), (colaborador, 3)]:
            sessao.add(
                Avistamento(
                    pessoa_id=pessoa.id,
                    latitude=Decimal("-22.505"),
                    longitude=Decimal("-43.179"),
                    visto_em=AGORA - timedelta(hours=horas),
                    registrado_por_id=usuario.id,
                )
            )
        sessao.flush()
        corpo = cliente.get(MARCADORES, headers=cabecalho(padrao)).json()
        assert corpo[0]["registrado_por"] == {
            "id": str(admin.id),
            "nome": "Adm Teste",
            "perfil": "ADMIN",
        }

    def test_sem_login(self, cliente):
        assert cliente.get(MARCADORES).status_code == 401


# --- Registrar avistamento ---


class TestAvistamentos:
    def test_registra_com_endereco_e_atualiza_ultima_localizacao(
        self, cliente, colaborador, criar_pessoa, sessao, geocodificador
    ):
        pessoa = criar_pessoa()
        resposta = cliente.post(
            AVISTAMENTOS,
            json=dados_avistamento(pessoa, observacao="  Perto do ponto de ônibus "),
            headers=cabecalho(colaborador),
        )
        assert resposta.status_code == 201, resposta.text
        corpo = resposta.json()
        assert corpo["endereco"] == "Rua do Imperador, 288 – Centro, Petrópolis"
        assert corpo["observacao"] == "Perto do ponto de ônibus"
        assert corpo["registrado_por"]["nome"] == "Colab Teste"
        assert corpo["registrado_por"]["perfil"] == colaborador.perfil.value
        assert corpo["mais_recente"] is True
        assert geocodificador.consultas == [(-22.51, -43.18)]

        sessao.refresh(pessoa)
        assert (pessoa.ultima_latitude, pessoa.ultima_longitude) == (
            Decimal("-22.510000"),
            Decimal("-43.180000"),
        )
        assert pessoa.ultimo_endereco == "Rua do Imperador, 288 – Centro, Petrópolis"

        log = sessao.scalars(
            select(LogAuditoria).where(LogAuditoria.acao == "AVISTAMENTO_REGISTRADO")
        ).one()
        assert log.detalhes == {"pessoa_id": str(pessoa.id)}

    def test_avistamento_antigo_nao_muda_a_ultima_localizacao(
        self, cliente, colaborador, criar_pessoa, sessao
    ):
        pessoa = criar_pessoa(visto_ha_horas=1)
        antigo = (AGORA - timedelta(days=3)).isoformat()
        resposta = cliente.post(
            AVISTAMENTOS,
            json=dados_avistamento(pessoa, visto_em=antigo),
            headers=cabecalho(colaborador),
        )
        assert resposta.json()["mais_recente"] is False
        sessao.refresh(pessoa)
        assert pessoa.ultimo_endereco == "Praça da Liberdade"
        assert sessao.scalars(select(Avistamento)).one().visto_em < pessoa.ultima_vez_visto

    def test_sem_endereco_quando_a_geocodificacao_falha(
        self, cliente, colaborador, criar_pessoa, geocodificador
    ):
        geocodificador.resposta = None
        resposta = cliente.post(
            AVISTAMENTOS, json=dados_avistamento(criar_pessoa()), headers=cabecalho(colaborador)
        )
        assert resposta.status_code == 201
        assert resposta.json()["endereco"] is None

    def test_pessoa_inativa_e_recusada(self, cliente, colaborador, criar_pessoa, sessao):
        pessoa = criar_pessoa(status=StatusPessoa.INATIVA)
        resposta = cliente.post(
            AVISTAMENTOS, json=dados_avistamento(pessoa), headers=cabecalho(colaborador)
        )
        assert resposta.status_code == 409
        assert "inativa" in resposta.json()["detail"]
        assert sessao.scalars(select(Avistamento)).all() == []

    def test_pessoa_usuaria_nao_registra(self, cliente, padrao, criar_pessoa):
        resposta = cliente.post(
            AVISTAMENTOS, json=dados_avistamento(criar_pessoa()), headers=cabecalho(padrao)
        )
        assert resposta.status_code == 403

    def test_no_futuro_e_recusado(self, cliente, colaborador, criar_pessoa):
        futuro = (AGORA + timedelta(hours=1)).isoformat()
        resposta = cliente.post(
            AVISTAMENTOS,
            json=dados_avistamento(criar_pessoa(), visto_em=futuro),
            headers=cabecalho(colaborador),
        )
        assert resposta.status_code == 422
        assert resposta.json()["campos"][0]["campo"] == "visto_em"

    @pytest.mark.parametrize("campo", [{"latitude": 91}, {"longitude": -181}])
    def test_coordenadas_invalidas(self, cliente, colaborador, criar_pessoa, campo):
        resposta = cliente.post(
            AVISTAMENTOS,
            json=dados_avistamento(criar_pessoa(), **campo),
            headers=cabecalho(colaborador),
        )
        assert resposta.status_code == 422

    def test_pessoa_inexistente(self, cliente, colaborador, criar_pessoa):
        dados = dados_avistamento(criar_pessoa())
        dados["pessoa_id"] = "00000000-0000-0000-0000-000000000000"
        resposta = cliente.post(AVISTAMENTOS, json=dados, headers=cabecalho(colaborador))
        assert resposta.status_code == 404

    def test_cadastro_com_avistamento_tambem_busca_o_endereco(
        self, cliente, colaborador, geocodificador
    ):
        resposta = cliente.post(
            "/api/v1/pessoas",
            json={
                "nome": "Rui",
                "sobrenome": "Lima",
                "consentimento": False,
                "avistamento": {
                    "latitude": -22.5,
                    "longitude": -43.2,
                    "visto_em": AGORA.isoformat(),
                },
            },
            headers=cabecalho(colaborador),
        )
        assert resposta.json()["ultimo_endereco"] == geocodificador.resposta


# --- Endpoint de endereço aproximado ---


class TestGeocodificacaoReversa:
    def test_gestor_consulta(self, cliente, colaborador):
        resposta = cliente.get(
            GEO, params={"lat": -22.5, "lng": -43.1}, headers=cabecalho(colaborador)
        )
        assert resposta.json() == {"endereco": "Rua do Imperador, 288 – Centro, Petrópolis"}

    def test_pessoa_usuaria_nao_consulta(self, cliente, padrao):
        resposta = cliente.get(GEO, params={"lat": -22.5, "lng": -43.1}, headers=cabecalho(padrao))
        assert resposta.status_code == 403

    def test_coordenada_fora_do_intervalo(self, cliente, colaborador):
        resposta = cliente.get(GEO, params={"lat": 100, "lng": 0}, headers=cabecalho(colaborador))
        assert resposta.status_code == 422


# --- Cliente do Nominatim ---

RESPOSTA_NOMINATIM = {
    "display_name": "288, Rua do Imperador, Centro, Petrópolis, RJ, Brasil",
    "address": {
        "road": "Rua do Imperador",
        "house_number": "288",
        "suburb": "Centro",
        "city": "Petrópolis",
    },
}


class Relogio:
    def __init__(self) -> None:
        self.agora = 100.0
        self.esperas: list[float] = []

    def __call__(self) -> float:
        return self.agora

    def dormir(self, segundos: float) -> None:
        self.esperas.append(round(segundos, 2))
        self.agora += segundos


def geocodificador_com(manipulador, relogio=None) -> tuple[GeocodificadorNominatim, list]:
    requisicoes: list[httpx.Request] = []

    def transporte(requisicao: httpx.Request) -> httpx.Response:
        requisicoes.append(requisicao)
        return manipulador(requisicao)

    relogio = relogio or Relogio()
    cliente = httpx.Client(transport=httpx.MockTransport(transporte))
    return GeocodificadorNominatim(cliente, relogio=relogio, dormir=relogio.dormir), requisicoes


class TestNominatim:
    def test_formata_endereco_curto(self):
        assert formatar_endereco(RESPOSTA_NOMINATIM) == (
            "Rua do Imperador, 288 – Centro, Petrópolis"
        )
        assert formatar_endereco({"display_name": "Algum lugar"}) == "Algum lugar"
        assert formatar_endereco({}) is None

    def test_usa_cache_para_pontos_vizinhos(self):
        geo, requisicoes = geocodificador_com(
            lambda r: httpx.Response(200, json=RESPOSTA_NOMINATIM)
        )
        assert geo.endereco(-22.50501, -43.17901) == "Rua do Imperador, 288 – Centro, Petrópolis"
        assert geo.endereco(-22.50504, -43.17899) == "Rua do Imperador, 288 – Centro, Petrópolis"
        assert len(requisicoes) == 1
        assert requisicoes[0].url.params["accept-language"] == "pt-BR"

    def test_respeita_uma_requisicao_por_segundo(self):
        relogio = Relogio()
        geo, requisicoes = geocodificador_com(
            lambda r: httpx.Response(200, json=RESPOSTA_NOMINATIM), relogio
        )
        geo.endereco(-22.1, -43.1)
        relogio.agora += 0.3
        geo.endereco(-22.2, -43.2)
        assert relogio.esperas == [0.7]
        assert len(requisicoes) == 2

    @pytest.mark.parametrize(
        "manipulador",
        [
            lambda r: httpx.Response(503),
            lambda r: httpx.Response(200, content=b"nao e json"),
            lambda r: (_ for _ in ()).throw(httpx.ConnectTimeout("sem rede")),
        ],
        ids=["erro-http", "json-invalido", "sem-rede"],
    )
    def test_falha_devolve_none_e_nao_vai_para_o_cache(self, manipulador):
        geo, requisicoes = geocodificador_com(manipulador)
        assert geo.endereco(-22.5, -43.1) is None
        assert geo.endereco(-22.5, -43.1) is None
        assert len(requisicoes) == 2

    def test_user_agent_proprio(self):
        cabecalhos = GeocodificadorNominatim()._http().headers
        assert cabecalhos["User-Agent"].startswith("ProjetoAurora/")

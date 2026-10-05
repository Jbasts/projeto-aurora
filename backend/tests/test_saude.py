from fastapi.testclient import TestClient

from app.core.config import obter_configuracoes
from app.main import app

cliente = TestClient(app)


def test_saude_responde_ok():
    resposta = cliente.get("/api/v1/saude")
    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_cors_permite_somente_frontend_url():
    origem = obter_configuracoes().FRONTEND_URL
    permitida = cliente.options(
        "/api/v1/saude",
        headers={"Origin": origem, "Access-Control-Request-Method": "GET"},
    )
    assert permitida.headers.get("access-control-allow-origin") == origem

    bloqueada = cliente.options(
        "/api/v1/saude",
        headers={"Origin": "http://site-estranho.com", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in bloqueada.headers


def test_rota_inexistente_usa_formato_de_erro():
    resposta = cliente.get("/api/v1/nao-existe")
    assert resposta.status_code == 404
    assert resposta.json() == {"detail": "Recurso não encontrado.", "codigo": "NAO_ENCONTRADO"}

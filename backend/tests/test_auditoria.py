from datetime import UTC, datetime, timedelta

import pytest

from app.core.seguranca import criar_token
from app.entities import LogAuditoria, PerfilUsuario
from app.services import auditoria
from app.services.auditoria import AcaoAuditoria

AUDITORIA = "/api/v1/auditoria"
AGORA = datetime.now(UTC)


def cabecalho(usuario) -> dict[str, str]:
    return {"Authorization": f"Bearer {criar_token(usuario.id, 'access')}"}


@pytest.fixture
def admin(criar_usuario):
    return criar_usuario(email="adm@exemplo.com", nome="Adm Teste", perfil=PerfilUsuario.ADMIN)


@pytest.fixture
def colaborador(criar_usuario):
    return criar_usuario(email="colab@exemplo.com", nome="Colab Teste")


@pytest.fixture
def logs(sessao, admin, colaborador):
    """Três registros com datas conhecidas (o mais recente primeiro na listagem)."""
    dados = [
        (AcaoAuditoria.LOGIN_FALHA, None, {"motivo": "EMAIL_DESCONHECIDO"}, 3),
        (AcaoAuditoria.PESSOA_VISUALIZADA, colaborador, None, 2),
        (AcaoAuditoria.USUARIO_APROVADO, admin, {"de": "PENDENTE", "para": "ATIVO"}, 1),
    ]
    entidades = {
        AcaoAuditoria.PESSOA_VISUALIZADA: ("pessoa", "abc"),
        AcaoAuditoria.USUARIO_APROVADO: ("usuario", str(colaborador.id)),
    }
    for acao, usuario, detalhes, dias in dados:
        entidade, entidade_id = entidades.get(acao, (None, None))
        sessao.add(
            LogAuditoria(
                acao=acao,
                usuario_id=usuario.id if usuario else None,
                entidade=entidade,
                entidade_id=entidade_id,
                detalhes=detalhes,
                ip="10.0.0.1",
                criado_em=AGORA - timedelta(days=dias),
            )
        )
    sessao.flush()


class TestPermissao:
    def test_somente_admin(self, cliente, colaborador, criar_usuario):
        padrao = criar_usuario(email="padrao@exemplo.com", perfil=PerfilUsuario.PADRAO)
        for usuario in (colaborador, padrao):
            resposta = cliente.get(AUDITORIA, headers=cabecalho(usuario))
            assert resposta.status_code == 403
            assert resposta.json()["codigo"] == "SEM_PERMISSAO"

    def test_sem_login(self, cliente):
        assert cliente.get(AUDITORIA).status_code == 401


class TestListagem:
    def test_mais_recente_primeiro_paginado(self, cliente, admin, colaborador, logs):
        corpo = cliente.get(AUDITORIA, params={"tamanho": 2}, headers=cabecalho(admin)).json()
        assert (corpo["total"], corpo["pagina"], corpo["tamanho"]) == (3, 1, 2)
        primeiro, segundo = corpo["itens"]
        assert primeiro["acao"] == "USUARIO_APROVADO"
        assert primeiro["usuario"] == {
            "id": str(admin.id),
            "nome": "Adm Teste",
            "email": "adm@exemplo.com",
            "perfil": "ADMIN",
        }
        assert primeiro["ip"] == "10.0.0.1"
        assert primeiro["usuario_afetado"]["nome"] == "Colab Teste"
        assert segundo["acao"] == "PESSOA_VISUALIZADA"
        assert (segundo["entidade"], segundo["entidade_id"]) == ("pessoa", "abc")
        assert segundo["usuario_afetado"] is None

        pagina2 = cliente.get(
            AUDITORIA, params={"tamanho": 2, "pagina": 2}, headers=cabecalho(admin)
        ).json()
        [ultimo] = pagina2["itens"]
        assert ultimo["usuario"] is None
        assert ultimo["detalhes"] == {"motivo": "EMAIL_DESCONHECIDO"}

    def test_padrao_e_5_por_pagina(self, cliente, admin):
        assert cliente.get(AUDITORIA, headers=cabecalho(admin)).json()["tamanho"] == 5

    def test_filtros(self, cliente, admin, colaborador, logs):
        def acoes(**params):
            corpo = cliente.get(AUDITORIA, params=params, headers=cabecalho(admin)).json()
            return [item["acao"] for item in corpo["itens"]]

        assert acoes(usuario_id=str(colaborador.id)) == ["PESSOA_VISUALIZADA"]
        assert acoes(acao="LOGIN_FALHA") == ["LOGIN_FALHA"]
        assert acoes(de=(AGORA - timedelta(days=2.5)).isoformat()) == [
            "USUARIO_APROVADO",
            "PESSOA_VISUALIZADA",
        ]
        assert acoes(
            de=(AGORA - timedelta(days=2.5)).isoformat(),
            ate=(AGORA - timedelta(days=1.5)).isoformat(),
        ) == ["PESSOA_VISUALIZADA"]

    def test_acao_desconhecida(self, cliente, admin):
        resposta = cliente.get(AUDITORIA, params={"acao": "XYZ"}, headers=cabecalho(admin))
        assert resposta.status_code == 422

    def test_periodo_invertido(self, cliente, admin):
        resposta = cliente.get(
            AUDITORIA,
            params={"de": AGORA.isoformat(), "ate": (AGORA - timedelta(days=1)).isoformat()},
            headers=cabecalho(admin),
        )
        assert resposta.status_code == 422
        assert resposta.json()["codigo"] == "VALIDACAO"


def test_acoes_listadas_batem_com_as_constantes():
    assert "AVISTAMENTO_REGISTRADO" in auditoria.ACOES
    assert len(auditoria.ACOES) == len(set(auditoria.ACOES)) == 25

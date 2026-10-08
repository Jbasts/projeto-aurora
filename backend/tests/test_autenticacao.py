from datetime import UTC, datetime, timedelta

import pytest
from fastapi import APIRouter, Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import obter_configuracoes
from app.core.erros import registrar_tratadores_de_erro
from app.core.limite import limiter
from app.core.permissoes import exigir_perfil
from app.core.seguranca import criar_token, verificar_senha
from app.db.sessao import obter_sessao
from app.entities import LogAuditoria, PerfilUsuario, StatusUsuario, Usuario
from tests.conftest import ENDERECO

LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/auth/me"
CADASTRO = "/api/v1/auth/cadastro"

MAX_TENTATIVAS = obter_configuracoes().MAX_TENTATIVAS_LOGIN
MINUTOS_BLOQUEIO = obter_configuracoes().MINUTOS_BLOQUEIO


def entrar(cliente: TestClient, email="pessoa@exemplo.com", senha="SenhaBoa123"):
    return cliente.post(LOGIN, json={"email": email, "senha": senha})


def acoes_auditadas(sessao: Session) -> list[tuple[str, str | None]]:
    logs = sessao.scalars(select(LogAuditoria).order_by(LogAuditoria.id))
    return [(log.acao, (log.detalhes or {}).get("motivo")) for log in logs]


class TestLogin:
    def test_sucesso_devolve_token_usuario_e_cookie_de_refresh(self, cliente, criar_usuario):
        criar_usuario()
        resposta = entrar(cliente, email="  PESSOA@Exemplo.com ")

        assert resposta.status_code == 200
        corpo = resposta.json()
        assert corpo["token_type"] == "bearer"
        assert corpo["access_token"]
        assert corpo["usuario"]["email"] == "pessoa@exemplo.com"
        assert corpo["usuario"]["perfil"] == "COLABORADOR"
        assert "senha_hash" not in corpo["usuario"]

        cookie = resposta.headers["set-cookie"]
        assert "aurora_refresh=" in cookie
        assert "HttpOnly" in cookie
        assert "SameSite=strict" in cookie
        assert "Path=/api/v1/auth" in cookie

    def test_sucesso_registra_auditoria(self, cliente, criar_usuario, sessao):
        criar_usuario()
        entrar(cliente)
        assert acoes_auditadas(sessao) == [("LOGIN_SUCESSO", None)]

    def test_email_inexistente_responde_credenciais_invalidas(self, cliente, sessao):
        resposta = entrar(cliente, email="ninguem@exemplo.com")
        assert resposta.status_code == 401
        assert resposta.json() == {
            "detail": "Email ou senha incorretos.",
            "codigo": "CREDENCIAIS_INVALIDAS",
        }
        assert acoes_auditadas(sessao) == [("LOGIN_FALHA", "EMAIL_DESCONHECIDO")]

    def test_senha_errada_responde_a_mesma_mensagem_e_soma_tentativa(
        self, cliente, criar_usuario, sessao
    ):
        usuario = criar_usuario()
        resposta = entrar(cliente, senha="errada123")
        assert resposta.status_code == 401
        assert resposta.json()["detail"] == "Email ou senha incorretos."
        sessao.refresh(usuario)
        assert usuario.tentativas_falhas == 1

    def test_quinta_falha_seguida_bloqueia_por_cinco_minutos(self, cliente, criar_usuario, sessao):
        usuario = criar_usuario()
        for _ in range(MAX_TENTATIVAS - 1):
            assert entrar(cliente, senha="errada123").status_code == 401

        resposta = entrar(cliente, senha="errada123")
        assert resposta.status_code == 423
        corpo = resposta.json()
        assert corpo["codigo"] == "CONTA_BLOQUEADA"
        assert corpo["segundos_restantes"] == MINUTOS_BLOQUEIO * 60

        sessao.refresh(usuario)
        assert usuario.tentativas_falhas == 0
        assert usuario.bloqueado_ate > datetime.now(UTC) + timedelta(minutes=MINUTOS_BLOQUEIO - 1)
        assert ("LOGIN_BLOQUEIO", "TENTATIVAS_ESGOTADAS") in acoes_auditadas(sessao)

    def test_conta_bloqueada_recusa_ate_senha_certa_sem_verificar(
        self, cliente, criar_usuario, sessao
    ):
        usuario = criar_usuario()
        usuario.bloqueado_ate = datetime.now(UTC) + timedelta(seconds=90)
        sessao.flush()

        resposta = entrar(cliente)
        assert resposta.status_code == 423
        assert 85 <= resposta.json()["segundos_restantes"] <= 90

        sessao.refresh(usuario)
        assert usuario.tentativas_falhas == 0  # não conta tentativa durante o bloqueio

    def test_depois_do_bloqueio_login_volta_a_funcionar_e_zera_contador(
        self, cliente, criar_usuario, sessao
    ):
        usuario = criar_usuario()
        usuario.bloqueado_ate = datetime.now(UTC) - timedelta(seconds=1)
        usuario.tentativas_falhas = 3
        sessao.flush()

        assert entrar(cliente).status_code == 200
        sessao.refresh(usuario)
        assert usuario.tentativas_falhas == 0
        assert usuario.bloqueado_ate is None

    def test_acerto_zera_tentativas_anteriores(self, cliente, criar_usuario, sessao):
        usuario = criar_usuario()
        for _ in range(MAX_TENTATIVAS - 1):
            entrar(cliente, senha="errada123")
        assert entrar(cliente).status_code == 200
        # Depois de acertar, são necessárias novas 5 falhas para bloquear.
        assert entrar(cliente, senha="errada123").status_code == 401
        sessao.refresh(usuario)
        assert usuario.tentativas_falhas == 1

    def test_conta_pendente_com_senha_certa(self, cliente, criar_usuario):
        criar_usuario(status=StatusUsuario.PENDENTE)
        resposta = entrar(cliente)
        assert resposta.status_code == 403
        assert resposta.json()["codigo"] == "CONTA_PENDENTE"
        assert "set-cookie" not in resposta.headers

    def test_conta_inativa_com_senha_certa(self, cliente, criar_usuario):
        criar_usuario(status=StatusUsuario.INATIVO)
        resposta = entrar(cliente)
        assert resposta.status_code == 403
        assert resposta.json()["codigo"] == "CONTA_INATIVA"

    def test_conta_pendente_com_senha_errada_nao_revela_status(self, cliente, criar_usuario):
        criar_usuario(status=StatusUsuario.PENDENTE)
        resposta = entrar(cliente, senha="errada123")
        assert resposta.status_code == 401
        assert resposta.json()["codigo"] == "CREDENCIAIS_INVALIDAS"


class TestSessao:
    def test_me_devolve_pessoa_logada(self, cliente, criar_usuario):
        criar_usuario()
        token = entrar(cliente).json()["access_token"]
        resposta = cliente.get(ME, headers={"Authorization": f"Bearer {token}"})
        assert resposta.status_code == 200
        assert resposta.json()["email"] == "pessoa@exemplo.com"

    def test_me_sem_token(self, cliente):
        resposta = cliente.get(ME)
        assert resposta.status_code == 401
        assert resposta.json()["codigo"] == "TOKEN_INVALIDO"

    def test_me_com_token_expirado(self, cliente, criar_usuario):
        usuario = criar_usuario()
        token = criar_token(usuario.id, "access", agora=datetime.now(UTC) - timedelta(hours=1))
        assert cliente.get(ME, headers={"Authorization": f"Bearer {token}"}).status_code == 401

    def test_refresh_token_nao_serve_como_access_token(self, cliente, criar_usuario):
        usuario = criar_usuario()
        token = criar_token(usuario.id, "refresh")
        assert cliente.get(ME, headers={"Authorization": f"Bearer {token}"}).status_code == 401

    def test_mudanca_de_perfil_e_status_vale_na_hora(self, cliente, criar_usuario, sessao):
        usuario = criar_usuario()
        cabecalho = {"Authorization": f"Bearer {entrar(cliente).json()['access_token']}"}

        usuario.perfil = PerfilUsuario.ADMIN
        sessao.flush()
        assert cliente.get(ME, headers=cabecalho).json()["perfil"] == "ADMIN"

        usuario.status = StatusUsuario.INATIVO
        sessao.flush()
        assert cliente.get(ME, headers=cabecalho).status_code == 401

    def test_refresh_com_cookie_renova_o_access_token(self, cliente, criar_usuario):
        criar_usuario()
        entrar(cliente)  # o TestClient guarda o cookie
        resposta = cliente.post(REFRESH)
        assert resposta.status_code == 200
        token = resposta.json()["access_token"]
        assert cliente.get(ME, headers={"Authorization": f"Bearer {token}"}).status_code == 200

    def test_refresh_sem_cookie(self, cliente):
        resposta = cliente.post(REFRESH)
        assert resposta.status_code == 401
        assert resposta.json()["codigo"] == "TOKEN_INVALIDO"

    def test_refresh_recusa_conta_que_deixou_de_estar_ativa(self, cliente, criar_usuario, sessao):
        usuario = criar_usuario()
        entrar(cliente)
        usuario.status = StatusUsuario.INATIVO
        sessao.flush()
        assert cliente.post(REFRESH).status_code == 401

    def test_refresh_recusa_access_token_no_cookie(self, cliente, criar_usuario):
        usuario = criar_usuario()
        cliente.cookies.set(
            "aurora_refresh", criar_token(usuario.id, "access"), path="/api/v1/auth"
        )
        assert cliente.post(REFRESH).status_code == 401

    def test_logout_apaga_o_cookie(self, cliente, criar_usuario):
        criar_usuario()
        entrar(cliente)
        resposta = cliente.post(LOGOUT)
        assert resposta.status_code == 204
        assert 'aurora_refresh=""' in resposta.headers["set-cookie"]
        assert cliente.post(REFRESH).status_code == 401


class TestExigirPerfil:
    @pytest.fixture
    def cliente_protegido(self, sessao) -> TestClient:
        router = APIRouter()

        @router.get("/so-admin", dependencies=[Depends(exigir_perfil(PerfilUsuario.ADMIN))])
        def so_admin():
            return {"ok": True}

        app = FastAPI()
        registrar_tratadores_de_erro(app)
        app.include_router(router)
        app.dependency_overrides[obter_sessao] = lambda: sessao
        return TestClient(app)

    @pytest.mark.parametrize(
        ("perfil", "esperado"),
        [
            (PerfilUsuario.ADMIN, 200),
            (PerfilUsuario.COLABORADOR, 403),
            (PerfilUsuario.PADRAO, 403),
        ],
    )
    def test_so_perfis_permitidos_passam(self, cliente_protegido, criar_usuario, perfil, esperado):
        usuario = criar_usuario(perfil=perfil)
        token = criar_token(usuario.id, "access")
        resposta = cliente_protegido.get("/so-admin", headers={"Authorization": f"Bearer {token}"})
        assert resposta.status_code == esperado
        if esperado == 403:
            assert resposta.json()["codigo"] == "SEM_PERMISSAO"


class TestCadastro:
    DADOS = {
        "nome": "Ana Souza",
        "email": "Ana.Souza@Exemplo.com",
        "telefone": "24988887777",
        "senha": "SenhaBoa123",
        "confirmar_senha": "SenhaBoa123",
        **ENDERECO,
    }

    def test_cria_conta_padrao_e_pendente(self, cliente, sessao):
        resposta = cliente.post(CADASTRO, json=self.DADOS)
        assert resposta.status_code == 201
        assert "Confirme seu email" in resposta.json()["mensagem"]

        usuario = sessao.scalar(select(Usuario).where(Usuario.email == "ana.souza@exemplo.com"))
        assert usuario.perfil == PerfilUsuario.PADRAO
        assert usuario.status == StatusUsuario.PENDENTE
        assert usuario.email_verificado_em is None
        assert usuario.telefone == "(24) 98888-7777"
        assert verificar_senha("SenhaBoa123", usuario.senha_hash)

    def test_guarda_o_endereco_normalizado(self, cliente, sessao):
        cliente.post(CADASTRO, json=self.DADOS)
        usuario = sessao.scalar(select(Usuario))
        assert (
            usuario.cep,
            usuario.logradouro,
            usuario.numero,
            usuario.complemento,
            usuario.bairro,
            usuario.cidade,
            usuario.uf,
        ) == (
            "25651-000",
            "Rua Afrânio de Melo Franco",
            "333",
            None,
            "Quitandinha",
            "Petrópolis",
            "RJ",
        )

    def test_envia_email_de_confirmacao(self, cliente, emails_enviados):
        cliente.post(CADASTRO, json=self.DADOS)
        assert len(emails_enviados) == 1
        assert emails_enviados[0].destinatario == "ana.souza@exemplo.com"
        assert "/verificar-email?token=" in emails_enviados[0].texto

    def test_ignora_tentativa_de_escolher_perfil(self, cliente, sessao):
        cliente.post(CADASTRO, json={**self.DADOS, "perfil": "ADMIN", "status": "ATIVO"})
        usuario = sessao.scalar(select(Usuario))
        assert usuario.perfil == PerfilUsuario.PADRAO
        assert usuario.status == StatusUsuario.PENDENTE

    def test_email_ja_cadastrado(self, cliente, criar_usuario):
        criar_usuario(email="ana.souza@exemplo.com")
        resposta = cliente.post(CADASTRO, json=self.DADOS)
        assert resposta.status_code == 422
        assert resposta.json()["campos"] == [
            {
                "campo": "email",
                "mensagem": "Este email já está cadastrado. Faça login ou recupere sua senha.",
            }
        ]

    @pytest.mark.parametrize(
        ("alteracao", "campo"),
        [
            ({"senha": "curta1", "confirmar_senha": "curta1"}, "senha"),
            ({"senha": "semnumeros", "confirmar_senha": "semnumeros"}, "senha"),
            ({"senha": "12345678", "confirmar_senha": "12345678"}, "senha"),
            ({"confirmar_senha": "OutraSenha123"}, "confirmar_senha"),
            ({"email": "nao-e-email"}, "email"),
            ({"telefone": "123"}, "telefone"),
            ({"nome": " "}, "nome"),
            ({"cep": "2565100"}, "cep"),
            ({"cep": ""}, "cep"),
            ({"logradouro": " "}, "logradouro"),
            ({"numero": ""}, "numero"),
            ({"cidade": ""}, "cidade"),
            ({"uf": "XX"}, "uf"),
        ],
    )
    def test_validacoes(self, cliente, alteracao, campo):
        resposta = cliente.post(CADASTRO, json={**self.DADOS, **alteracao})
        assert resposta.status_code == 422
        corpo = resposta.json()
        assert corpo["codigo"] == "VALIDACAO"
        assert campo in [c["campo"] for c in corpo["campos"]]
        assert all(c["mensagem"] for c in corpo["campos"])


def test_rate_limit_nas_rotas_de_autenticacao(cliente):
    limiter.enabled = True
    limiter.reset()
    respostas = [entrar(cliente, email="x@exemplo.com").status_code for _ in range(35)]
    limiter.reset()
    assert 429 in respostas
    assert respostas[0] == 401

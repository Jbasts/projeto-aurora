import re
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.config import obter_configuracoes
from app.core.seguranca import criar_token
from app.entities import (
    LogAuditoria,
    PerfilUsuario,
    StatusUsuario,
    TokenVerificacaoEmail,
    Usuario,
)
from app.services import verificacao_email
from app.services.email import Email
from tests.conftest import CPF, ENDERECO, postar_cadastro

CADASTRO = "/api/v1/auth/cadastro"
VERIFICAR = "/api/v1/auth/verificar-email"
REENVIAR = "/api/v1/auth/reenviar-verificacao"
LOGIN = "/api/v1/auth/login"
RECUPERAR = "/api/v1/auth/recuperar-senha"
REDEFINIR = "/api/v1/auth/redefinir-senha"
USUARIOS = "/api/v1/usuarios"

DADOS = {
    "nome": "Ana",
    "sobrenome": "Souza",
    "cpf": CPF,
    "telefone": "24988887777",
    "data_nascimento": "1990-05-20",
    "email": "ana@exemplo.com",
    "senha": "SenhaBoa123",
    "confirmar_senha": "SenhaBoa123",
    **ENDERECO,
}


def token_do_email(email: Email, rota: str = "verificar-email") -> str:
    encontrado = re.search(rf"{rota}\?token=([\w-]+)", email.texto)
    assert encontrado, "o email deve conter o link"
    return encontrado.group(1)


def cadastrar(cliente, emails_enviados) -> str:
    assert postar_cadastro(cliente, DADOS).status_code == 201
    return token_do_email(emails_enviados[-1])


def entrar(cliente, senha: str = DADOS["senha"]):
    return cliente.post(LOGIN, json={"login": DADOS["email"], "senha": senha})


class TestConfirmacao:
    def test_link_confirma_o_email_e_gera_auditoria(self, cliente, emails_enviados, sessao):
        token = cadastrar(cliente, emails_enviados)
        resposta = cliente.post(VERIFICAR, json={"token": token})
        assert resposta.status_code == 200
        assert "Email confirmado" in resposta.json()["mensagem"]

        ana = sessao.scalar(select(Usuario).where(Usuario.email == DADOS["email"]))
        assert ana.email_verificado_em is not None
        log = sessao.scalar(select(LogAuditoria).where(LogAuditoria.acao == "EMAIL_VERIFICADO"))
        assert log is not None and log.entidade_id == str(ana.id)

    def test_link_e_de_uso_unico(self, cliente, emails_enviados):
        token = cadastrar(cliente, emails_enviados)
        cliente.post(VERIFICAR, json={"token": token})
        resposta = cliente.post(VERIFICAR, json={"token": token})
        assert resposta.status_code == 400
        assert resposta.json()["codigo"] == "TOKEN_INVALIDO"

    def test_link_expirado(self, cliente, emails_enviados, sessao):
        token = cadastrar(cliente, emails_enviados)
        registro = sessao.scalar(select(TokenVerificacaoEmail))
        registro.expira_em = datetime.now(UTC) - timedelta(seconds=1)
        sessao.flush()
        assert cliente.post(VERIFICAR, json={"token": token}).json()["codigo"] == "TOKEN_INVALIDO"

    def test_link_inventado(self, cliente):
        assert cliente.post(VERIFICAR, json={"token": "nao-existe"}).status_code == 400

    def test_vale_24_horas_e_o_banco_guarda_so_o_hash(self, cliente, emails_enviados, sessao):
        token = cadastrar(cliente, emails_enviados)
        registro = sessao.scalar(select(TokenVerificacaoEmail))
        horas = (registro.expira_em - registro.criado_em) / timedelta(hours=1)
        assert horas == obter_configuracoes().HORAS_VALIDADE_TOKEN_EMAIL == 24
        assert registro.token_hash != token


class TestLogin:
    def test_sem_confirmar_nao_entra(self, cliente, emails_enviados):
        cadastrar(cliente, emails_enviados)
        resposta = entrar(cliente)
        assert resposta.status_code == 403
        assert resposta.json()["codigo"] == "EMAIL_NAO_VERIFICADO"

    def test_senha_errada_nao_revela_que_falta_confirmar(self, cliente, emails_enviados):
        cadastrar(cliente, emails_enviados)
        assert entrar(cliente, "Errada123").json()["codigo"] == "CREDENCIAIS_INVALIDAS"

    def test_depois_de_confirmar_ainda_espera_aprovacao(self, cliente, emails_enviados):
        token = cadastrar(cliente, emails_enviados)
        cliente.post(VERIFICAR, json={"token": token})
        assert entrar(cliente).json()["codigo"] == "CONTA_PENDENTE"

    def test_redefinir_senha_pelo_email_tambem_confirma(self, cliente, emails_enviados):
        cadastrar(cliente, emails_enviados)
        cliente.post(RECUPERAR, json={"login": DADOS["email"]})
        token = token_do_email(emails_enviados[-1], "redefinir-senha")
        cliente.post(
            REDEFINIR,
            json={"token": token, "senha": "NovaSenha456", "confirmar_senha": "NovaSenha456"},
        )
        assert entrar(cliente, "NovaSenha456").json()["codigo"] == "CONTA_PENDENTE"


class TestReenvio:
    def test_novo_link_invalida_o_anterior(self, cliente, emails_enviados):
        antigo = cadastrar(cliente, emails_enviados)
        resposta = cliente.post(REENVIAR, json={"email": "ANA@exemplo.com"})
        assert resposta.status_code == 200
        assert resposta.json()["mensagem"] == verificacao_email.MENSAGEM_REENVIO
        novo = token_do_email(emails_enviados[-1])

        assert cliente.post(VERIFICAR, json={"token": antigo}).status_code == 400
        assert cliente.post(VERIFICAR, json={"token": novo}).status_code == 200

    def test_resposta_neutra_sem_email_para_desconhecido_ou_confirmado(
        self, cliente, emails_enviados, criar_usuario
    ):
        criar_usuario(email="confirmada@exemplo.com")
        for email in ("ninguem@exemplo.com", "confirmada@exemplo.com"):
            resposta = cliente.post(REENVIAR, json={"email": email})
            assert resposta.json()["mensagem"] == verificacao_email.MENSAGEM_REENVIO
        assert emails_enviados == []

    def test_limite_por_hora(self, cliente, emails_enviados):
        cadastrar(cliente, emails_enviados)  # o email do cadastro conta como o 1º envio
        for _ in range(5):
            cliente.post(REENVIAR, json={"email": DADOS["email"]})
        assert len(emails_enviados) == obter_configuracoes().MAX_REENVIOS_VERIFICACAO_POR_HORA


class TestGestao:
    def test_admin_so_ve_e_aprova_depois_da_confirmacao(
        self, cliente, emails_enviados, criar_usuario, sessao
    ):
        admin = criar_usuario(email="admin@exemplo.com", perfil=PerfilUsuario.ADMIN)
        cabecalho = {"Authorization": f"Bearer {criar_token(admin.id, 'access')}"}
        token = cadastrar(cliente, emails_enviados)
        ana = sessao.scalar(select(Usuario).where(Usuario.email == DADOS["email"]))

        def pendentes() -> list[str]:
            resposta = cliente.get(USUARIOS, params={"status": "PENDENTE"}, headers=cabecalho)
            return [u["email"] for u in resposta.json()["itens"]]

        def aprovar():
            return cliente.patch(
                f"{USUARIOS}/{ana.id}", json={"status": "ATIVO"}, headers=cabecalho
            )

        assert pendentes() == []
        assert aprovar().json()["codigo"] == "EMAIL_NAO_VERIFICADO"

        cliente.post(VERIFICAR, json={"token": token})
        assert pendentes() == [DADOS["email"]]
        assert aprovar().json()["status"] == StatusUsuario.ATIVO
        assert entrar(cliente).status_code == 200

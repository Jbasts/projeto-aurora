import re
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.seguranca import hash_token_redefinicao, verificar_senha
from app.entities import StatusUsuario, TokenRedefinicaoSenha, Usuario
from app.services.email import Email

RECUPERAR = "/api/v1/auth/recuperar-senha"
VALIDAR = "/api/v1/auth/redefinir-senha/validar"
REDEFINIR = "/api/v1/auth/redefinir-senha"

MENSAGEM_NEUTRA = (
    "Se este email estiver cadastrado, você vai receber um link para criar uma nova senha."
)


def token_do_email(email: Email) -> str:
    encontrado = re.search(r"redefinir-senha\?token=([\w-]+)", email.texto)
    assert encontrado, "o email deve conter o link de redefinição"
    return encontrado.group(1)


def pedir(cliente, email="pessoa@exemplo.com"):
    return cliente.post(RECUPERAR, json={"email": email})


def redefinir(cliente, token, senha="NovaSenha456", confirmar=None):
    return cliente.post(
        REDEFINIR,
        json={"token": token, "senha": senha, "confirmar_senha": confirmar or senha},
    )


class TestPedido:
    def test_email_cadastrado_recebe_link(self, cliente, criar_usuario, emails_enviados, sessao):
        criar_usuario(nome="Bruna Lima")
        resposta = pedir(cliente, email=" PESSOA@exemplo.com ")

        assert resposta.status_code == 200
        assert resposta.json() == {"mensagem": MENSAGEM_NEUTRA}
        assert len(emails_enviados) == 1
        email = emails_enviados[0]
        assert email.destinatario == "pessoa@exemplo.com"
        assert "Bruna Lima" in email.html
        assert "http://localhost:5173/redefinir-senha?token=" in email.html

        # O banco guarda só o hash SHA-256, nunca o token.
        token = token_do_email(email)
        registro = sessao.scalar(select(TokenRedefinicaoSenha))
        assert registro.token_hash == hash_token_redefinicao(token)
        assert registro.token_hash != token
        validade = registro.expira_em - registro.criado_em
        assert validade == timedelta(minutes=30)

    def test_email_desconhecido_recebe_a_mesma_resposta(self, cliente, emails_enviados):
        resposta = pedir(cliente, email="ninguem@exemplo.com")
        assert resposta.status_code == 200
        assert resposta.json() == {"mensagem": MENSAGEM_NEUTRA}
        assert emails_enviados == []

    def test_limite_de_3_pedidos_por_hora(self, cliente, criar_usuario, emails_enviados, sessao):
        criar_usuario()
        respostas = [pedir(cliente) for _ in range(4)]
        assert all(r.json() == {"mensagem": MENSAGEM_NEUTRA} for r in respostas)
        assert len(emails_enviados) == 3
        assert sessao.scalar(select(func.count()).select_from(TokenRedefinicaoSenha)) == 3

    def test_pedidos_de_mais_de_uma_hora_nao_contam(
        self, cliente, criar_usuario, emails_enviados, sessao
    ):
        criar_usuario()
        for _ in range(3):
            pedir(cliente)
        for token in sessao.scalars(select(TokenRedefinicaoSenha)):
            token.criado_em = datetime.now(UTC) - timedelta(hours=2)
        sessao.flush()

        pedir(cliente)
        assert len(emails_enviados) == 4

    def test_novo_pedido_invalida_os_anteriores(self, cliente, criar_usuario, emails_enviados):
        criar_usuario()
        pedir(cliente)
        pedir(cliente)
        primeiro, segundo = (token_do_email(e) for e in emails_enviados)

        assert cliente.get(VALIDAR, params={"token": primeiro}).status_code == 400
        assert cliente.get(VALIDAR, params={"token": segundo}).status_code == 200

    def test_email_invalido(self, cliente):
        resposta = pedir(cliente, email="nao-e-email")
        assert resposta.status_code == 422


class TestValidacaoERedefinicao:
    @pytest.fixture
    def token(self, cliente, criar_usuario, emails_enviados) -> str:
        criar_usuario(senha="SenhaAntiga1")
        pedir(cliente)
        return token_do_email(emails_enviados[0])

    def test_token_valido(self, cliente, token):
        resposta = cliente.get(VALIDAR, params={"token": token})
        assert resposta.status_code == 200
        assert resposta.json() == {"valido": True}

    @pytest.mark.parametrize("token_invalido", ["inexistente", ""])
    def test_token_inexistente(self, cliente, token_invalido):
        resposta = cliente.get(VALIDAR, params={"token": token_invalido})
        assert resposta.status_code == 400
        assert resposta.json()["codigo"] == "TOKEN_INVALIDO"

    def test_token_expirado(self, cliente, token, sessao: Session):
        registro = sessao.scalar(select(TokenRedefinicaoSenha))
        registro.expira_em = datetime.now(UTC) - timedelta(seconds=1)
        sessao.flush()
        assert cliente.get(VALIDAR, params={"token": token}).status_code == 400
        assert redefinir(cliente, token).json()["codigo"] == "TOKEN_INVALIDO"

    def test_redefine_senha_marca_token_usado_e_zera_bloqueio(self, cliente, token, sessao):
        usuario = sessao.scalar(select(Usuario))
        usuario.tentativas_falhas = 4
        usuario.bloqueado_ate = datetime.now(UTC) + timedelta(minutes=3)
        sessao.flush()

        resposta = redefinir(cliente, token)
        assert resposta.status_code == 200
        assert resposta.json() == {"mensagem": "Senha atualizada. Faça login com a nova senha."}

        sessao.refresh(usuario)
        assert verificar_senha("NovaSenha456", usuario.senha_hash)
        assert not verificar_senha("SenhaAntiga1", usuario.senha_hash)
        assert usuario.tentativas_falhas == 0
        assert usuario.bloqueado_ate is None
        assert sessao.scalar(select(TokenRedefinicaoSenha)).usado_em is not None

        login = cliente.post(
            "/api/v1/auth/login", json={"email": usuario.email, "senha": "NovaSenha456"}
        )
        assert login.status_code == 200

    def test_token_so_pode_ser_usado_uma_vez(self, cliente, token):
        assert redefinir(cliente, token).status_code == 200
        segunda = redefinir(cliente, token, senha="OutraSenha789")
        assert segunda.status_code == 400
        assert segunda.json()["codigo"] == "TOKEN_INVALIDO"

    def test_nova_senha_segue_as_regras_do_cadastro(self, cliente, token):
        assert redefinir(cliente, token, senha="fraca").status_code == 422
        assert redefinir(cliente, token, confirmar="Diferente123").status_code == 422
        # O token continua valendo depois de um erro de validação.
        assert cliente.get(VALIDAR, params={"token": token}).status_code == 200

    def test_conta_pendente_pode_redefinir_mas_continua_pendente(
        self, cliente, criar_usuario, emails_enviados, sessao
    ):
        usuario = criar_usuario(email="pendente@exemplo.com", status=StatusUsuario.PENDENTE)
        pedir(cliente, email="pendente@exemplo.com")
        assert redefinir(cliente, token_do_email(emails_enviados[0])).status_code == 200
        sessao.refresh(usuario)
        assert usuario.status == StatusUsuario.PENDENTE

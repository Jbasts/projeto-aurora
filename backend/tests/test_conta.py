"""Foto da conta, login e recuperação por CPF, trocas de email e CPF, dados de contas antigas."""

import re
from datetime import UTC, datetime, timedelta

import pytest
from PIL import Image
from sqlalchemy import select

from app.core.seguranca import criar_token
from app.entities import (
    LogAuditoria,
    PerfilUsuario,
    SolicitacaoAlteracao,
    StatusSolicitacao,
    TokenTrocaEmail,
    Usuario,
)
from app.services.email import Email
from tests.conftest import CPF, ENDERECO, foto_png, postar_cadastro

LOGIN = "/api/v1/auth/login"
RECUPERAR = "/api/v1/auth/recuperar-senha"
CONFIRMAR = "/api/v1/auth/confirmar-novo-email"
AUTH_ME = "/api/v1/auth/me"
ME_FOTO = "/api/v1/me/foto"
PEDIDO = "/api/v1/me/pedido-alteracao"
USUARIOS = "/api/v1/usuarios"
SOLICITACOES = "/api/v1/solicitacoes"

SENHA = "SenhaBoa123"
OUTRO_CPF = "111.444.777-35"


def cabecalho(usuario) -> dict[str, str]:
    return {"Authorization": f"Bearer {criar_token(usuario.id, 'access')}"}


def acoes(sessao) -> list[str]:
    return [log.acao for log in sessao.scalars(select(LogAuditoria).order_by(LogAuditoria.id))]


def token_do_email(email: Email) -> str:
    encontrado = re.search(r"confirmar-novo-email\?token=([\w-]+)", email.texto)
    assert encontrado, "o email deve conter o link"
    return encontrado.group(1)


def pendentes(cliente, admin) -> list[dict]:
    resposta = cliente.get(SOLICITACOES, params={"status": "PENDENTE"}, headers=cabecalho(admin))
    assert resposta.status_code == 200
    return resposta.json()["itens"]


def entrar(cliente, login: str, senha: str = SENHA):
    return cliente.post(LOGIN, json={"login": login, "senha": senha})


@pytest.fixture
def ana(criar_usuario):
    return criar_usuario(email="ana@exemplo.com", nome="Ana", cpf="52998224725")


@pytest.fixture
def admin(criar_usuario):
    return criar_usuario(email="admin@exemplo.com", perfil=PerfilUsuario.ADMIN, nome="Admin")


DADOS_CADASTRO = {
    "nome": "Bia",
    "sobrenome": "Lima",
    "cpf": CPF,
    "email": "bia@exemplo.com",
    "telefone": "24988887777",
    "senha": SENHA,
    "confirmar_senha": SENHA,
    **ENDERECO,
}


class TestFotoNoCadastro:
    def test_foto_e_obrigatoria(self, cliente):
        campos = {chave: str(valor) for chave, valor in DADOS_CADASTRO.items()}
        resposta = cliente.post("/api/v1/auth/cadastro", data=campos)
        assert resposta.status_code == 422
        assert [c["campo"] for c in resposta.json()["campos"]] == ["foto"]

    def test_arquivo_que_nao_e_imagem(self, cliente, sessao):
        resposta = postar_cadastro(cliente, DADOS_CADASTRO, foto=b"nao sou uma imagem")
        assert resposta.status_code == 422
        assert resposta.json()["campos"] == [
            {"campo": "foto", "mensagem": "Envie uma foto em JPG, PNG ou WEBP."}
        ]
        assert sessao.scalar(select(Usuario)) is None

    def test_guarda_foto_e_miniatura_em_webp(self, cliente, sessao, pasta_de_uploads):
        assert postar_cadastro(cliente, DADOS_CADASTRO, foto=foto_png(900, 600)).status_code == 201
        usuario = sessao.scalar(select(Usuario))
        assert usuario.foto_id is not None
        foto = Image.open(pasta_de_uploads / f"{usuario.foto_id}.webp")
        miniatura = Image.open(pasta_de_uploads / f"{usuario.foto_id}_miniatura.webp")
        assert (foto.format, foto.size, miniatura.size) == ("WEBP", (900, 600), (400, 267))

    def test_cadastro_recusado_nao_deixa_arquivo(self, cliente, criar_usuario, pasta_de_uploads):
        criar_usuario(email="bia@exemplo.com")
        assert postar_cadastro(cliente, DADOS_CADASTRO).status_code == 422
        assert list(pasta_de_uploads.iterdir()) == []


class TestFotoDaConta:
    def test_conta_sem_foto(self, cliente, ana):
        corpo = cliente.get(AUTH_ME, headers=cabecalho(ana)).json()
        assert (corpo["foto_url"], corpo["foto_miniatura_url"]) == (None, None)
        assert "foto_id" not in corpo

    def test_enviar_trocar_e_abrir_pela_url_assinada(self, cliente, ana, sessao, pasta_de_uploads):
        resposta = cliente.put(
            ME_FOTO, headers=cabecalho(ana), files={"arquivo": ("a.png", foto_png(), "image/png")}
        )
        assert resposta.status_code == 200
        primeira = ana.foto_id
        url = resposta.json()["foto_miniatura_url"]
        assert url.startswith(f"/api/v1/arquivos/contas/{primeira}?variante=miniatura")

        imagem = cliente.get(url)
        assert imagem.status_code == 200
        assert imagem.headers["content-type"] == "image/webp"

        cliente.put(
            ME_FOTO, headers=cabecalho(ana), files={"arquivo": ("b.png", foto_png(), "image/png")}
        )
        assert ana.foto_id != primeira
        # A anterior sai do disco e o link dela para de funcionar.
        assert sorted(p.name for p in pasta_de_uploads.iterdir()) == sorted(
            [f"{ana.foto_id}.webp", f"{ana.foto_id}_miniatura.webp"]
        )
        assert cliente.get(url).status_code == 404
        assert acoes(sessao) == ["MEUS_DADOS_ALTERADOS", "MEUS_DADOS_ALTERADOS"]

    def test_url_sem_assinatura_valida(self, cliente, ana):
        resposta = cliente.put(
            ME_FOTO, headers=cabecalho(ana), files={"arquivo": ("a.png", foto_png(), "image/png")}
        )
        url = resposta.json()["foto_url"]
        assert cliente.get(url.replace("assinatura=", "assinatura=0")).status_code == 403
        # A assinatura de foto de conta não serve na rota de fotos de pessoas.
        assert cliente.get(url.replace("/arquivos/contas/", "/arquivos/")).status_code == 403

    def test_admin_ve_a_foto_na_lista(self, cliente, ana, admin):
        cliente.put(
            ME_FOTO, headers=cabecalho(ana), files={"arquivo": ("a.png", foto_png(), "image/png")}
        )
        itens = cliente.get(USUARIOS, headers=cabecalho(admin)).json()["itens"]
        linha = next(item for item in itens if item["id"] == str(ana.id))
        assert linha["foto_miniatura_url"].startswith(f"/api/v1/arquivos/contas/{ana.foto_id}")


class TestLoginPorCpf:
    @pytest.mark.parametrize("login", ["529.982.247-25", "52998224725", " 529 982 247 25 "])
    def test_entra_com_cpf(self, cliente, ana, login):
        resposta = entrar(cliente, login)
        assert resposta.status_code == 200
        assert resposta.json()["usuario"]["email"] == "ana@exemplo.com"

    def test_cpf_desconhecido_ou_senha_errada(self, cliente, ana):
        for login, senha in [(OUTRO_CPF, SENHA), (CPF, "errada123"), ("abc", SENHA)]:
            resposta = entrar(cliente, login, senha)
            assert resposta.status_code == 401
            assert resposta.json()["detail"] == "Email, CPF ou senha incorretos."

    def test_recuperar_senha_pelo_cpf_manda_para_o_email_da_conta(
        self, cliente, ana, emails_enviados
    ):
        assert cliente.post(RECUPERAR, json={"login": CPF}).status_code == 200
        assert [e.destinatario for e in emails_enviados] == ["ana@exemplo.com"]

    def test_recuperar_com_cpf_desconhecido_e_neutro(self, cliente, ana, emails_enviados):
        resposta = cliente.post(RECUPERAR, json={"login": OUTRO_CPF})
        assert resposta.status_code == 200
        assert emails_enviados == []


class TestTrocaDeEmail:
    def pedir(self, cliente, usuario, **dados):
        return cliente.post(PEDIDO, headers=cabecalho(usuario), json={"senha": SENHA, **dados})

    def test_fluxo_completo_link_e_depois_admin(self, cliente, ana, admin, emails_enviados, sessao):
        resposta = self.pedir(cliente, ana, email="Ana.Nova@Exemplo.com")
        assert resposta.status_code == 200
        corpo = resposta.json()
        assert corpo["email"] == "ana@exemplo.com"
        assert corpo["solicitacao_email"]["status"] == "AGUARDANDO_EMAIL"
        assert corpo["solicitacao_email"]["valor_novo_exibicao"] == "ana.nova@exemplo.com"
        assert [e.destinatario for e in emails_enviados] == ["ana.nova@exemplo.com"]
        # Antes do link, a pessoa administradora ainda não vê a solicitação.
        assert pendentes(cliente, admin) == []

        confirmacao = cliente.post(CONFIRMAR, json={"token": token_do_email(emails_enviados[0])})
        assert confirmacao.status_code == 200
        assert "pessoa administradora vai analisar" in confirmacao.json()["mensagem"]
        # Link aberto não troca o email: ainda falta a aprovação.
        assert entrar(cliente, "ana@exemplo.com").status_code == 200
        assert entrar(cliente, "ana.nova@exemplo.com").status_code == 401

        [linha] = pendentes(cliente, admin)
        assert (linha["tipo"], linha["valor_atual"], linha["valor_novo"]) == (
            "EMAIL",
            "ana@exemplo.com",
            "ana.nova@exemplo.com",
        )
        assert linha["usuario"]["nome_completo"] == "Ana"
        assert linha["email_confirmado_em"] is not None

        aprovada = cliente.post(f"{SOLICITACOES}/{linha['id']}/aprovar", headers=cabecalho(admin))
        assert aprovada.status_code == 200
        assert (aprovada.json()["status"], aprovada.json()["decidido_por"]) == ("APROVADA", "Admin")
        sessao.refresh(ana)
        assert ana.email == "ana.nova@exemplo.com"
        assert entrar(cliente, "ana.nova@exemplo.com").status_code == 200
        assert entrar(cliente, "ana@exemplo.com").status_code == 401
        assert {
            "SOLICITACAO_CRIADA",
            "SOLICITACAO_EMAIL_CONFIRMADO",
            "SOLICITACAO_APROVADA",
        } <= set(acoes(sessao))
        log = next(
            log
            for log in sessao.scalars(select(LogAuditoria))
            if log.acao == "SOLICITACAO_APROVADA"
        )
        assert log.usuario_id == admin.id
        assert "ana.nova" not in str(log.detalhes)

    def confirmar_e_aprovar(self, cliente, admin, emails_enviados):
        cliente.post(CONFIRMAR, json={"token": token_do_email(emails_enviados[-1])})
        [linha] = pendentes(cliente, admin)
        return cliente.post(f"{SOLICITACOES}/{linha['id']}/aprovar", headers=cabecalho(admin))

    def test_email_antigo_fica_livre_para_outra_conta(self, cliente, ana, admin, emails_enviados):
        self.pedir(cliente, ana, email="ana.nova@exemplo.com")
        assert self.confirmar_e_aprovar(cliente, admin, emails_enviados).status_code == 200
        dados = {**DADOS_CADASTRO, "email": "ana@exemplo.com", "cpf": "390.533.447-05"}
        assert postar_cadastro(cliente, dados).status_code == 201

    def test_recusar_nao_muda_nada(self, cliente, ana, admin, emails_enviados, sessao):
        self.pedir(cliente, ana, email="ana.nova@exemplo.com")
        cliente.post(CONFIRMAR, json={"token": token_do_email(emails_enviados[0])})
        [linha] = pendentes(cliente, admin)
        resposta = cliente.post(f"{SOLICITACOES}/{linha['id']}/recusar", headers=cabecalho(admin))
        assert resposta.json()["status"] == "RECUSADA"
        sessao.refresh(ana)
        assert ana.email == "ana@exemplo.com"
        corpo = cliente.get(AUTH_ME, headers=cabecalho(ana)).json()
        assert corpo["solicitacao_email"]["status"] == "RECUSADA"
        # Já decidida: não dá para decidir de novo.
        de_novo = cliente.post(f"{SOLICITACOES}/{linha['id']}/aprovar", headers=cabecalho(admin))
        assert de_novo.status_code == 409

    def test_link_de_uso_unico_e_com_validade(self, cliente, ana, emails_enviados, sessao):
        self.pedir(cliente, ana, email="ana.nova@exemplo.com")
        token = token_do_email(emails_enviados[0])
        registro = sessao.scalar(select(TokenTrocaEmail))
        assert registro.token_hash != token
        assert registro.expira_em - registro.criado_em == timedelta(hours=24)
        registro.expira_em = datetime.now(UTC) - timedelta(seconds=1)
        sessao.flush()
        assert cliente.post(CONFIRMAR, json={"token": token}).status_code == 400

    def test_novo_pedido_substitui_o_anterior(self, cliente, ana, emails_enviados, sessao):
        self.pedir(cliente, ana, email="primeiro@exemplo.com")
        self.pedir(cliente, ana, email="segundo@exemplo.com")
        antigo = cliente.post(CONFIRMAR, json={"token": token_do_email(emails_enviados[0])})
        assert antigo.status_code == 400
        novo = cliente.post(CONFIRMAR, json={"token": token_do_email(emails_enviados[1])})
        assert novo.status_code == 200
        status = sorted(s.status for s in sessao.scalars(select(SolicitacaoAlteracao)))
        assert status == [StatusSolicitacao.CANCELADA, StatusSolicitacao.PENDENTE]

    def test_cancelar(self, cliente, ana, emails_enviados):
        self.pedir(cliente, ana, email="ana.nova@exemplo.com")
        resposta = cliente.delete("/api/v1/me/troca-email", headers=cabecalho(ana))
        assert resposta.json()["solicitacao_email"]["status"] == "CANCELADA"
        token = token_do_email(emails_enviados[0])
        assert cliente.post(CONFIRMAR, json={"token": token}).status_code == 400

    def test_email_de_outra_conta_ou_igual(self, cliente, ana, criar_usuario):
        criar_usuario(email="outra@exemplo.com")
        for email, mensagem in [
            ("outra@exemplo.com", "Este email já está em uso por outra conta."),
            ("ANA@exemplo.com", "Este já é o email da sua conta."),
        ]:
            resposta = self.pedir(cliente, ana, email=email)
            assert resposta.status_code == 422
            assert resposta.json()["campos"] == [{"campo": "email", "mensagem": mensagem}]

    def test_outra_conta_pega_o_email_antes_da_aprovacao(
        self, cliente, ana, admin, criar_usuario, emails_enviados
    ):
        self.pedir(cliente, ana, email="disputado@exemplo.com")
        cliente.post(CONFIRMAR, json={"token": token_do_email(emails_enviados[0])})
        criar_usuario(email="disputado@exemplo.com")
        [linha] = pendentes(cliente, admin)
        resposta = cliente.post(f"{SOLICITACOES}/{linha['id']}/aprovar", headers=cabecalho(admin))
        assert resposta.status_code == 409
        assert resposta.json()["codigo"] == "EMAIL_EM_USO"

    def test_senha_errada_nao_muda_nada(self, cliente, ana, emails_enviados, sessao):
        resposta = cliente.post(
            PEDIDO,
            headers=cabecalho(ana),
            json={"senha": "errada123", "email": "x@exemplo.com", "cpf": OUTRO_CPF},
        )
        assert resposta.status_code == 422
        assert resposta.json()["campos"] == [{"campo": "senha", "mensagem": "Senha incorreta."}]
        assert emails_enviados == []
        assert sessao.scalar(select(SolicitacaoAlteracao)) is None

    def test_precisa_de_email_ou_cpf(self, cliente, ana):
        assert self.pedir(cliente, ana, email="", cpf="").status_code == 422

    def test_limite_por_hora(self, cliente, ana):
        for i in range(3):
            assert self.pedir(cliente, ana, email=f"n{i}@exemplo.com").status_code == 200
        assert self.pedir(cliente, ana, email="n4@exemplo.com").status_code == 429


class TestTrocaDeCpf:
    def pedir(self, cliente, usuario, cpf=OUTRO_CPF):
        return cliente.post(PEDIDO, headers=cabecalho(usuario), json={"senha": SENHA, "cpf": cpf})

    def test_vai_direto_para_o_admin_e_o_cpf_atual_continua(self, cliente, ana, admin, sessao):
        corpo = self.pedir(cliente, ana).json()
        assert corpo["cpf_mascarado"] == "***.982.247-**"
        assert corpo["solicitacao_cpf"]["status"] == "PENDENTE"
        assert corpo["solicitacao_cpf"]["valor_novo_exibicao"] == "***.444.777-**"
        assert "valor_novo" not in corpo["solicitacao_cpf"]
        assert entrar(cliente, CPF).status_code == 200
        assert entrar(cliente, OUTRO_CPF).status_code == 401

        [linha] = pendentes(cliente, admin)
        assert (linha["tipo"], linha["valor_atual"], linha["valor_novo"]) == (
            "CPF",
            "529.982.247-25",
            "111.444.777-35",
        )
        log = sessao.scalars(select(LogAuditoria)).first()
        assert log.acao == "SOLICITACAO_CRIADA"
        assert "11144477735" not in str(log.detalhes)

    def test_admin_aprova(self, cliente, ana, admin, sessao):
        self.pedir(cliente, ana)
        [linha] = pendentes(cliente, admin)
        resposta = cliente.post(f"{SOLICITACOES}/{linha['id']}/aprovar", headers=cabecalho(admin))
        assert resposta.status_code == 200
        sessao.refresh(ana)
        assert ana.cpf == "11144477735"
        assert entrar(cliente, OUTRO_CPF).status_code == 200
        assert pendentes(cliente, admin) == []

    def test_email_e_cpf_no_mesmo_pedido(self, cliente, ana, admin, emails_enviados):
        resposta = cliente.post(
            PEDIDO,
            headers=cabecalho(ana),
            json={"senha": SENHA, "email": "ana.nova@exemplo.com", "cpf": OUTRO_CPF},
        )
        corpo = resposta.json()
        assert corpo["solicitacao_email"]["status"] == "AGUARDANDO_EMAIL"
        assert corpo["solicitacao_cpf"]["status"] == "PENDENTE"
        assert len(emails_enviados) == 1
        assert [linha["tipo"] for linha in pendentes(cliente, admin)] == ["CPF"]

    def test_cpf_ocupado_depois_do_pedido(self, cliente, ana, admin, criar_usuario):
        self.pedir(cliente, ana)
        criar_usuario(email="outra@exemplo.com", cpf="11144477735")
        [linha] = pendentes(cliente, admin)
        resposta = cliente.post(f"{SOLICITACOES}/{linha['id']}/aprovar", headers=cabecalho(admin))
        assert resposta.status_code == 409
        assert resposta.json()["codigo"] == "CPF_EM_USO"

    def test_cpf_de_outra_conta_ou_igual(self, cliente, ana, criar_usuario):
        criar_usuario(email="outra@exemplo.com", cpf="11144477735")
        for cpf, mensagem in [
            (OUTRO_CPF, "Este CPF já está cadastrado em outra conta."),
            (CPF, "Este já é o CPF da sua conta."),
            ("111.444.777-36", "Informe um CPF válido."),
        ]:
            resposta = self.pedir(cliente, ana, cpf=cpf)
            assert resposta.status_code == 422
            assert resposta.json()["campos"] == [{"campo": "cpf", "mensagem": mensagem}]

    def test_cancelar(self, cliente, ana, admin):
        self.pedir(cliente, ana)
        resposta = cliente.delete("/api/v1/me/troca-cpf", headers=cabecalho(ana))
        assert resposta.json()["solicitacao_cpf"]["status"] == "CANCELADA"
        assert pendentes(cliente, admin) == []

    @pytest.mark.parametrize("perfil", [PerfilUsuario.COLABORADOR, PerfilUsuario.PADRAO])
    def test_solicitacoes_sao_somente_para_admin(self, cliente, ana, admin, criar_usuario, perfil):
        self.pedir(cliente, ana)
        [linha] = pendentes(cliente, admin)
        outra = criar_usuario(email="outra@exemplo.com", perfil=perfil)
        assert cliente.get(SOLICITACOES, headers=cabecalho(outra)).status_code == 403
        resposta = cliente.post(f"{SOLICITACOES}/{linha['id']}/aprovar", headers=cabecalho(outra))
        assert resposta.status_code == 403

    def test_dados_do_usuario_mostram_as_abertas(self, cliente, ana, admin):
        self.pedir(cliente, ana)
        corpo = cliente.get(f"{USUARIOS}/{ana.id}", headers=cabecalho(admin)).json()
        [aberta] = corpo["solicitacoes_abertas"]
        assert (aberta["tipo"], aberta["valor_novo"]) == ("CPF", "111.444.777-35")


class TestCompletarDadosDeContaAntiga:
    def completar(self, cliente, admin, usuario, **dados):
        return cliente.patch(f"{USUARIOS}/{usuario.id}/dados", headers=cabecalho(admin), json=dados)

    def test_admin_preenche_cpf_e_sobrenome_vazios(self, cliente, admin, criar_usuario, sessao):
        antiga = criar_usuario(email="antiga@exemplo.com")
        resposta = self.completar(cliente, admin, antiga, sobrenome=" Lima ", cpf=OUTRO_CPF)
        assert resposta.status_code == 200
        assert (resposta.json()["sobrenome"], resposta.json()["cpf"]) == ("Lima", "111.444.777-35")
        log = sessao.scalars(select(LogAuditoria)).first()
        assert log.acao == "USUARIO_DADOS_COMPLETADOS"
        assert log.detalhes == {"campos": ["sobrenome", "cpf"]}

    def test_nao_substitui_o_que_ja_existe(self, cliente, admin, ana):
        resposta = self.completar(cliente, admin, ana, cpf=OUTRO_CPF)
        assert resposta.status_code == 422
        assert resposta.json()["campos"][0]["campo"] == "cpf"

    def test_cpf_de_outra_conta(self, cliente, admin, ana, criar_usuario):
        antiga = criar_usuario(email="antiga@exemplo.com")
        resposta = self.completar(cliente, admin, antiga, cpf=CPF)
        assert resposta.status_code == 422
        assert resposta.json()["campos"] == [
            {"campo": "cpf", "mensagem": "Este CPF já está cadastrado em outra conta."}
        ]

    def test_somente_admin(self, cliente, ana, criar_usuario):
        antiga = criar_usuario(email="antiga@exemplo.com")
        assert self.completar(cliente, ana, antiga, cpf=OUTRO_CPF).status_code == 403

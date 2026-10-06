import pytest
from sqlalchemy import select

from app.core.seguranca import criar_token, verificar_senha
from app.entities import LogAuditoria, PerfilUsuario, StatusUsuario

USUARIOS = "/api/v1/usuarios"
ME = "/api/v1/me"
ME_SENHA = "/api/v1/me/senha"
AUTH_ME = "/api/v1/auth/me"

ADMIN, COLABORADOR, PADRAO = PerfilUsuario.ADMIN, PerfilUsuario.COLABORADOR, PerfilUsuario.PADRAO
PENDENTE, ATIVO, INATIVO = StatusUsuario.PENDENTE, StatusUsuario.ATIVO, StatusUsuario.INATIVO


def cabecalho(usuario) -> dict[str, str]:
    return {"Authorization": f"Bearer {criar_token(usuario.id, 'access')}"}


def logs(sessao, acao_prefixo: str = "") -> list[LogAuditoria]:
    return [
        log
        for log in sessao.scalars(select(LogAuditoria).order_by(LogAuditoria.id))
        if log.acao.startswith(acao_prefixo)
    ]


@pytest.fixture
def admin(criar_usuario):
    return criar_usuario(email="admin@exemplo.com", perfil=ADMIN, nome="Admin Principal")


# --- Permissões por perfil (seção 2) ---


class TestPermissoes:
    @pytest.mark.parametrize("perfil", [COLABORADOR, PADRAO])
    def test_listar_usuarios_e_somente_para_admin(self, cliente, criar_usuario, perfil):
        usuario = criar_usuario(perfil=perfil)
        resposta = cliente.get(USUARIOS, headers=cabecalho(usuario))
        assert resposta.status_code == 403
        assert resposta.json()["codigo"] == "SEM_PERMISSAO"

    @pytest.mark.parametrize("perfil", [COLABORADOR, PADRAO])
    def test_alterar_usuario_e_somente_para_admin(self, cliente, criar_usuario, sessao, perfil):
        usuario = criar_usuario(perfil=perfil)
        pendente = criar_usuario(email="novo@exemplo.com", perfil=PADRAO, status=PENDENTE)
        resposta = cliente.patch(
            f"{USUARIOS}/{pendente.id}", json={"status": "ATIVO"}, headers=cabecalho(usuario)
        )
        assert resposta.status_code == 403
        sessao.refresh(pendente)
        assert pendente.status == PENDENTE

    def test_colaborador_nao_se_promove_a_admin(self, cliente, criar_usuario, sessao):
        usuario = criar_usuario(perfil=COLABORADOR)
        resposta = cliente.patch(
            f"{USUARIOS}/{usuario.id}", json={"perfil": "ADMIN"}, headers=cabecalho(usuario)
        )
        assert resposta.status_code == 403
        sessao.refresh(usuario)
        assert usuario.perfil == COLABORADOR

    def test_admin_lista_usuarios(self, cliente, admin):
        assert cliente.get(USUARIOS, headers=cabecalho(admin)).status_code == 200

    @pytest.mark.parametrize("perfil", [ADMIN, COLABORADOR, PADRAO])
    def test_meu_perfil_vale_para_todos_os_perfis(self, cliente, criar_usuario, perfil):
        usuario = criar_usuario(perfil=perfil)
        resposta = cliente.patch(ME, json={"nome": "Nome Novo"}, headers=cabecalho(usuario))
        assert resposta.status_code == 200

    @pytest.mark.parametrize(
        ("metodo", "caminho"),
        [
            ("get", USUARIOS),
            ("patch", f"{USUARIOS}/00000000-0000-0000-0000-000000000000"),
            ("patch", ME),
            ("patch", ME_SENHA),
        ],
    )
    def test_sem_login_responde_401(self, cliente, metodo, caminho):
        resposta = cliente.request(metodo.upper(), caminho, json={})
        assert resposta.status_code == 401
        assert resposta.json()["codigo"] == "TOKEN_INVALIDO"

    def test_admin_inativado_perde_o_acesso_na_hora(self, cliente, admin, criar_usuario):
        outro_admin = criar_usuario(email="outro@exemplo.com", perfil=ADMIN)
        cliente.patch(
            f"{USUARIOS}/{outro_admin.id}", json={"status": "INATIVO"}, headers=cabecalho(admin)
        )
        assert cliente.get(USUARIOS, headers=cabecalho(outro_admin)).status_code == 401

    def test_rebaixado_perde_a_permissao_na_hora(self, cliente, admin, criar_usuario):
        outro_admin = criar_usuario(email="outro@exemplo.com", perfil=ADMIN)
        cliente.patch(
            f"{USUARIOS}/{outro_admin.id}", json={"perfil": "PADRAO"}, headers=cabecalho(admin)
        )
        assert cliente.get(USUARIOS, headers=cabecalho(outro_admin)).status_code == 403


# --- Listagem (seção 3.5) ---


class TestListagem:
    def test_pendentes_primeiro_depois_por_nome(self, cliente, admin, criar_usuario):
        criar_usuario(email="b@exemplo.com", nome="Bruna", perfil=PADRAO)
        criar_usuario(email="z@exemplo.com", nome="Zuleide", perfil=PADRAO, status=PENDENTE)
        criar_usuario(email="c@exemplo.com", nome="Carlos", perfil=PADRAO, status=INATIVO)
        criar_usuario(email="d@exemplo.com", nome="Davi", perfil=PADRAO, status=PENDENTE)

        corpo = cliente.get(USUARIOS, headers=cabecalho(admin)).json()

        assert [u["nome"] for u in corpo["itens"]] == [
            "Davi",
            "Zuleide",
            "Admin Principal",
            "Bruna",
            "Carlos",
        ]
        assert corpo["total"] == 5
        assert set(corpo["itens"][0]) == {
            "id",
            "nome",
            "email",
            "telefone",
            "perfil",
            "status",
            "criado_em",
        }

    def test_busca_por_nome_sem_acento_ou_por_email(self, cliente, admin, criar_usuario):
        criar_usuario(email="joao@exemplo.com", nome="João Conceição")
        criar_usuario(email="maria.silva@outro.org", nome="Maria")

        por_nome = cliente.get(USUARIOS, params={"busca": "conceicao"}, headers=cabecalho(admin))
        por_email = cliente.get(USUARIOS, params={"busca": "OUTRO.ORG"}, headers=cabecalho(admin))

        assert [u["nome"] for u in por_nome.json()["itens"]] == ["João Conceição"]
        assert [u["nome"] for u in por_email.json()["itens"]] == ["Maria"]

    def test_busca_trata_curingas_como_texto(self, cliente, admin, criar_usuario):
        criar_usuario(email="ana@exemplo.com", nome="Ana")
        resposta = cliente.get(USUARIOS, params={"busca": "%"}, headers=cabecalho(admin))
        assert resposta.json()["total"] == 0

    def test_filtros_por_perfil_e_status(self, cliente, admin, criar_usuario):
        criar_usuario(email="p1@exemplo.com", perfil=PADRAO, status=PENDENTE)
        criar_usuario(email="p2@exemplo.com", perfil=PADRAO, status=ATIVO)
        criar_usuario(email="c1@exemplo.com", perfil=COLABORADOR, status=PENDENTE)

        resposta = cliente.get(
            USUARIOS, params={"perfil": "PADRAO", "status": "PENDENTE"}, headers=cabecalho(admin)
        )
        assert [u["email"] for u in resposta.json()["itens"]] == ["p1@exemplo.com"]

    def test_paginacao_no_servidor(self, cliente, admin, criar_usuario):
        for i in range(4):
            criar_usuario(email=f"u{i}@exemplo.com", nome=f"Usuária {i}")

        resposta = cliente.get(
            USUARIOS, params={"pagina": 2, "tamanho": 2}, headers=cabecalho(admin)
        )
        corpo = resposta.json()
        assert corpo["total"] == 5
        assert corpo["pagina"] == 2
        assert corpo["tamanho"] == 2
        assert [u["nome"] for u in corpo["itens"]] == ["Usuária 1", "Usuária 2"]

    def test_padrao_de_cinco_por_pagina(self, cliente, admin, criar_usuario):
        for i in range(6):
            criar_usuario(email=f"u{i}@exemplo.com")
        corpo = cliente.get(USUARIOS, headers=cabecalho(admin)).json()
        assert (corpo["tamanho"], len(corpo["itens"]), corpo["total"]) == (5, 5, 7)

    def test_aceita_ate_cem_por_pagina(self, cliente, admin):
        resposta = cliente.get(USUARIOS, params={"tamanho": 100}, headers=cabecalho(admin))
        assert resposta.status_code == 200

    def test_tamanho_de_pagina_limitado(self, cliente, admin):
        resposta = cliente.get(USUARIOS, params={"tamanho": 500}, headers=cabecalho(admin))
        assert resposta.status_code == 422


# --- Ações (seção 3.5) ---


class TestAcoes:
    def alterar(self, cliente, admin, usuario, **dados):
        return cliente.patch(f"{USUARIOS}/{usuario.id}", json=dados, headers=cabecalho(admin))

    def test_aprovar_libera_o_login(self, cliente, admin, criar_usuario):
        pendente = criar_usuario(email="novo@exemplo.com", perfil=PADRAO, status=PENDENTE)
        resposta = self.alterar(cliente, admin, pendente, status="ATIVO")
        assert resposta.status_code == 200
        assert resposta.json()["status"] == "ATIVO"

        login = cliente.post(
            "/api/v1/auth/login", json={"email": "novo@exemplo.com", "senha": "SenhaBoa123"}
        )
        assert login.status_code == 200

    def test_aprovar_ja_com_perfil(self, cliente, admin, criar_usuario, sessao):
        pendente = criar_usuario(email="novo@exemplo.com", perfil=PADRAO, status=PENDENTE)
        resposta = self.alterar(cliente, admin, pendente, status="ATIVO", perfil="COLABORADOR")
        assert resposta.json()["perfil"] == "COLABORADOR"
        assert [(log.acao, log.detalhes) for log in logs(sessao, "USUARIO_")] == [
            ("USUARIO_APROVADO", {"de": "PENDENTE", "para": "ATIVO"}),
            ("USUARIO_PERFIL_ALTERADO", {"de": "PADRAO", "para": "COLABORADOR"}),
        ]

    def test_recusar_deixa_a_conta_inativa(self, cliente, admin, criar_usuario, sessao):
        pendente = criar_usuario(email="novo@exemplo.com", perfil=PADRAO, status=PENDENTE)
        assert self.alterar(cliente, admin, pendente, status="INATIVO").status_code == 200
        sessao.refresh(pendente)
        assert pendente.status == INATIVO
        assert logs(sessao, "USUARIO_")[0].acao == "USUARIO_RECUSADO"

    def test_inativar_e_reativar(self, cliente, admin, criar_usuario, sessao):
        usuario = criar_usuario(email="u@exemplo.com")
        assert self.alterar(cliente, admin, usuario, status="INATIVO").status_code == 200
        assert self.alterar(cliente, admin, usuario, status="ATIVO").status_code == 200
        assert [log.acao for log in logs(sessao, "USUARIO_")] == [
            "USUARIO_INATIVADO",
            "USUARIO_REATIVADO",
        ]

    def test_auditoria_registra_quem_fez_e_o_alvo(self, cliente, admin, criar_usuario, sessao):
        usuario = criar_usuario(email="u@exemplo.com")
        self.alterar(cliente, admin, usuario, perfil="PADRAO")
        log = logs(sessao, "USUARIO_")[0]
        assert log.usuario_id == admin.id
        assert log.entidade == "usuario"
        assert log.entidade_id == str(usuario.id)

    def test_sem_mudanca_nao_gera_auditoria(self, cliente, admin, criar_usuario, sessao):
        usuario = criar_usuario(email="u@exemplo.com")
        assert self.alterar(cliente, admin, usuario, status="ATIVO").status_code == 200
        assert logs(sessao, "USUARIO_") == []

    def test_nao_volta_para_pendente(self, cliente, admin, criar_usuario):
        usuario = criar_usuario(email="u@exemplo.com")
        resposta = self.alterar(cliente, admin, usuario, status="PENDENTE")
        assert resposta.status_code == 422
        assert resposta.json()["codigo"] == "VALIDACAO"

    def test_corpo_vazio_e_invalido(self, cliente, admin, criar_usuario):
        usuario = criar_usuario(email="u@exemplo.com")
        assert self.alterar(cliente, admin, usuario).status_code == 422

    def test_usuario_inexistente(self, cliente, admin):
        resposta = cliente.patch(
            f"{USUARIOS}/00000000-0000-0000-0000-000000000000",
            json={"status": "ATIVO"},
            headers=cabecalho(admin),
        )
        assert resposta.status_code == 404
        assert resposta.json()["codigo"] == "NAO_ENCONTRADO"


class TestUltimoAdmin:
    def alterar(self, cliente, admin, usuario, **dados):
        return cliente.patch(f"{USUARIOS}/{usuario.id}", json=dados, headers=cabecalho(admin))

    @pytest.mark.parametrize("dados", [{"perfil": "COLABORADOR"}, {"status": "INATIVO"}])
    def test_nao_rebaixa_nem_inativa_o_ultimo_admin(self, cliente, admin, sessao, dados):
        resposta = self.alterar(cliente, admin, admin, **dados)
        assert resposta.status_code == 409
        assert resposta.json()["codigo"] == "ULTIMO_ADMIN"
        sessao.refresh(admin)
        assert (admin.perfil, admin.status) == (ADMIN, ATIVO)
        assert logs(sessao, "USUARIO_") == []

    def test_admins_inativos_nao_contam(self, cliente, admin, criar_usuario):
        criar_usuario(email="inativo@exemplo.com", perfil=ADMIN, status=INATIVO)
        criar_usuario(email="pendente@exemplo.com", perfil=ADMIN, status=PENDENTE)
        assert self.alterar(cliente, admin, admin, status="INATIVO").status_code == 409

    def test_com_outro_admin_ativo_pode_rebaixar(self, cliente, admin, criar_usuario, sessao):
        criar_usuario(email="outro@exemplo.com", perfil=ADMIN)
        assert self.alterar(cliente, admin, admin, perfil="COLABORADOR").status_code == 200
        sessao.refresh(admin)
        assert admin.perfil == COLABORADOR

    def test_promover_e_depois_rebaixar_o_antigo(self, cliente, admin, criar_usuario):
        colaborador = criar_usuario(email="c@exemplo.com", perfil=COLABORADOR)
        assert self.alterar(cliente, admin, colaborador, perfil="ADMIN").status_code == 200
        assert self.alterar(cliente, colaborador, admin, status="INATIVO").status_code == 200


# --- Meu perfil (seção 3.6) ---


class TestMeuPerfil:
    def test_altera_nome_e_telefone(self, cliente, criar_usuario, sessao):
        usuario = criar_usuario(perfil=PADRAO)
        resposta = cliente.patch(
            ME,
            json={"nome": "  Nome Novo ", "telefone": "24999998888"},
            headers=cabecalho(usuario),
        )
        assert resposta.status_code == 200
        assert resposta.json()["nome"] == "Nome Novo"
        assert resposta.json()["telefone"] == "(24) 99999-8888"
        assert cliente.get(AUTH_ME, headers=cabecalho(usuario)).json()["nome"] == "Nome Novo"

        log = logs(sessao, "MEUS_DADOS")[0]
        assert log.detalhes == {"campos": ["nome", "telefone"]}

    def test_ignora_email_e_perfil(self, cliente, criar_usuario, sessao):
        usuario = criar_usuario(perfil=PADRAO)
        cliente.patch(
            ME,
            json={"nome": "Pessoa de Teste", "email": "x@exemplo.com", "perfil": "ADMIN"},
            headers=cabecalho(usuario),
        )
        sessao.refresh(usuario)
        assert (usuario.email, usuario.perfil) == ("pessoa@exemplo.com", PADRAO)

    def test_valida_nome_e_telefone(self, cliente, criar_usuario):
        usuario = criar_usuario()
        resposta = cliente.patch(
            ME, json={"nome": " ", "telefone": "123"}, headers=cabecalho(usuario)
        )
        assert resposta.status_code == 422
        assert {c["campo"] for c in resposta.json()["campos"]} == {"nome", "telefone"}

    def test_troca_senha(self, cliente, criar_usuario, sessao):
        usuario = criar_usuario()
        resposta = cliente.patch(
            ME_SENHA,
            json={
                "senha_atual": "SenhaBoa123",
                "senha": "NovaSenha9",
                "confirmar_senha": "NovaSenha9",
            },
            headers=cabecalho(usuario),
        )
        assert resposta.status_code == 200
        sessao.refresh(usuario)
        assert verificar_senha("NovaSenha9", usuario.senha_hash)
        assert logs(sessao, "SENHA_ALTERADA")

    def test_senha_atual_errada(self, cliente, criar_usuario, sessao):
        usuario = criar_usuario()
        resposta = cliente.patch(
            ME_SENHA,
            json={
                "senha_atual": "errada123",
                "senha": "NovaSenha9",
                "confirmar_senha": "NovaSenha9",
            },
            headers=cabecalho(usuario),
        )
        assert resposta.status_code == 422
        assert resposta.json()["campos"] == [
            {"campo": "senha_atual", "mensagem": "Senha atual incorreta."}
        ]
        sessao.refresh(usuario)
        assert verificar_senha("SenhaBoa123", usuario.senha_hash)

    @pytest.mark.parametrize(
        ("senha", "confirmar", "campo"),
        [("curta1", "curta1", "senha"), ("NovaSenha9", "OutraSenha9", "confirmar_senha")],
    )
    def test_nova_senha_segue_as_regras_do_cadastro(
        self, cliente, criar_usuario, senha, confirmar, campo
    ):
        usuario = criar_usuario()
        resposta = cliente.patch(
            ME_SENHA,
            json={"senha_atual": "SenhaBoa123", "senha": senha, "confirmar_senha": confirmar},
            headers=cabecalho(usuario),
        )
        assert resposta.status_code == 422
        assert [c["campo"] for c in resposta.json()["campos"]] == [campo]

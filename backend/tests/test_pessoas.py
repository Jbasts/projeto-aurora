from datetime import UTC, datetime, timedelta
from io import BytesIO
from urllib.parse import parse_qs, urlparse

import pytest
from PIL import Image
from sqlalchemy import func, select

from app.core.config import obter_configuracoes
from app.core.seguranca import criar_token
from app.entities import (
    Avistamento,
    Foto,
    LogAuditoria,
    PerfilUsuario,
    Pessoa,
    StatusPessoa,
    TipoFoto,
)
from app.services import fotos as servico_fotos

PESSOAS = "/api/v1/pessoas"
ADMIN, COLABORADOR, PADRAO = PerfilUsuario.ADMIN, PerfilUsuario.COLABORADOR, PerfilUsuario.PADRAO


def cabecalho(usuario) -> dict[str, str]:
    return {"Authorization": f"Bearer {criar_token(usuario.id, 'access')}"}


def acoes(sessao, prefixo: str = "") -> list[LogAuditoria]:
    return [
        log
        for log in sessao.scalars(select(LogAuditoria).order_by(LogAuditoria.id))
        if log.acao.startswith(prefixo)
    ]


def dados_pessoa(**extras) -> dict:
    return {
        "nome": "João",
        "sobrenome": "da Conceição",
        "apelido": "Joca",
        "idade_aproximada": 45,
        "telefone": "24999998888",
        "observacoes": "Prefere ser chamado de Joca.",
        "consentimento": True,
        **extras,
    }


def imagem(
    largura=300, altura=200, formato="JPEG", exif: Image.Exif | None = None, modo="RGB"
) -> bytes:
    saida = BytesIO()
    Image.new(modo, (largura, altura), (200, 30, 30)).save(
        saida, formato, **({"exif": exif} if exif is not None else {})
    )
    return saida.getvalue()


def exif_com_gps(orientacao: int | None = None) -> Image.Exif:
    exif = Image.Exif()
    exif[0x010F] = "CameraDeTeste"  # Make
    if orientacao:
        exif[0x0112] = orientacao
    gps = exif.get_ifd(0x8825)
    gps[1] = "S"
    gps[2] = (22.0, 30.0, 18.0)
    return exif


@pytest.fixture(autouse=True)
def pasta_de_uploads(tmp_path, monkeypatch):
    monkeypatch.setattr(obter_configuracoes(), "UPLOAD_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture
def colaborador(criar_usuario):
    return criar_usuario(email="colab@exemplo.com", perfil=COLABORADOR, nome="Colab Teste")


@pytest.fixture
def padrao(criar_usuario):
    return criar_usuario(email="padrao@exemplo.com", perfil=PADRAO)


@pytest.fixture
def pessoa(cliente, colaborador):
    resposta = cliente.post(PESSOAS, json=dados_pessoa(), headers=cabecalho(colaborador))
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def enviar_foto(cliente, usuario, pessoa_id, rota="fotos", conteudo=None, **form):
    return cliente.post(
        f"{PESSOAS}/{pessoa_id}/{rota}",
        files={"arquivo": ("foto.jpg", conteudo or imagem(), "image/jpeg")},
        data=form,
        headers=cabecalho(usuario),
    )


# --- Permissões (seção 2) ---


class TestPermissoes:
    def test_pessoa_usuaria_nao_cadastra(self, cliente, padrao):
        resposta = cliente.post(PESSOAS, json=dados_pessoa(), headers=cabecalho(padrao))
        assert resposta.status_code == 403
        assert resposta.json()["codigo"] == "SEM_PERMISSAO"

    @pytest.mark.parametrize(
        ("metodo", "sufixo", "corpo"),
        [
            ("PUT", "", dados_pessoa()),
            ("POST", "/inativar", {}),
            ("POST", "/reativar", None),
        ],
    )
    def test_pessoa_usuaria_nao_altera(self, cliente, padrao, pessoa, metodo, sufixo, corpo):
        resposta = cliente.request(
            metodo, f"{PESSOAS}/{pessoa['id']}{sufixo}", json=corpo, headers=cabecalho(padrao)
        )
        assert resposta.status_code == 403

    def test_pessoa_usuaria_nao_envia_nem_remove_foto(self, cliente, padrao, colaborador, pessoa):
        assert enviar_foto(cliente, padrao, pessoa["id"]).status_code == 403
        foto = enviar_foto(cliente, colaborador, pessoa["id"]).json()
        resposta = cliente.delete(
            f"{PESSOAS}/{pessoa['id']}/fotos/{foto['id']}", headers=cabecalho(padrao)
        )
        assert resposta.status_code == 403

    @pytest.mark.parametrize("perfil", [ADMIN, COLABORADOR])
    def test_admin_e_colaborador_cadastram(self, cliente, criar_usuario, perfil):
        usuario = criar_usuario(perfil=perfil)
        resposta = cliente.post(PESSOAS, json=dados_pessoa(), headers=cabecalho(usuario))
        assert resposta.status_code == 201

    def test_todos_veem_pessoa_ativa(self, cliente, padrao, pessoa):
        resposta = cliente.get(f"{PESSOAS}/{pessoa['id']}", headers=cabecalho(padrao))
        assert resposta.status_code == 200

    def test_pessoa_usuaria_nao_ve_pessoa_inativa(self, cliente, padrao, colaborador, pessoa):
        cliente.post(f"{PESSOAS}/{pessoa['id']}/inativar", headers=cabecalho(colaborador))
        resposta = cliente.get(f"{PESSOAS}/{pessoa['id']}", headers=cabecalho(padrao))
        assert resposta.status_code == 404
        resposta = cliente.get(f"{PESSOAS}/{pessoa['id']}", headers=cabecalho(colaborador))
        assert resposta.status_code == 200

    def test_sem_login(self, cliente, pessoa):
        assert cliente.get(f"{PESSOAS}/{pessoa['id']}").status_code == 401
        assert cliente.post(PESSOAS, json=dados_pessoa()).status_code == 401


# --- Cadastro, visualização e edição (seção 3.7) ---


class TestCadastro:
    def test_cadastro_normaliza_e_devolve_o_perfil(self, cliente, colaborador, pessoa, sessao):
        assert pessoa["status"] == "ATIVA"
        assert pessoa["telefone"] == "(24) 99999-8888"
        assert pessoa["cadastrada_por"] == {"id": str(colaborador.id), "nome": "Colab Teste"}
        assert pessoa["consentimento_em"] is not None
        assert pessoa["foto_perfil"] is None
        assert pessoa["album"] == []
        assert pessoa["ultima_vez_visto"] is None
        assert [log.acao for log in acoes(sessao, "PESSOA_")] == ["PESSOA_CADASTRADA"]

    def test_campos_opcionais_vazios_viram_nulos(self, cliente, colaborador):
        resposta = cliente.post(
            PESSOAS,
            json=dados_pessoa(apelido="  ", email="", telefone="", observacoes=""),
            headers=cabecalho(colaborador),
        )
        corpo = resposta.json()
        assert (corpo["apelido"], corpo["email"], corpo["telefone"]) == (None, None, None)

    def test_validacoes(self, cliente, colaborador):
        resposta = cliente.post(
            PESSOAS,
            json=dados_pessoa(nome=" ", email="invalido", idade_aproximada=200, telefone="12"),
            headers=cabecalho(colaborador),
        )
        assert resposta.status_code == 422
        campos = {c["campo"] for c in resposta.json()["campos"]}
        assert campos == {"nome", "email", "idade_aproximada", "telefone"}

    def test_consentimento_e_obrigatorio(self, cliente, colaborador):
        dados = dados_pessoa()
        del dados["consentimento"]
        resposta = cliente.post(PESSOAS, json=dados, headers=cabecalho(colaborador))
        assert [c["campo"] for c in resposta.json()["campos"]] == ["consentimento"]

    def test_cadastro_com_avistamento_atualiza_a_ultima_localizacao(
        self, cliente, colaborador, sessao
    ):
        visto_em = datetime.now(UTC) - timedelta(hours=2)
        resposta = cliente.post(
            PESSOAS,
            json=dados_pessoa(
                avistamento={
                    "latitude": -22.5051234,
                    "longitude": -43.179,
                    "visto_em": visto_em.isoformat(),
                }
            ),
            headers=cabecalho(colaborador),
        )
        corpo = resposta.json()
        assert corpo["ultima_latitude"] == -22.505123
        assert corpo["ultima_longitude"] == -43.179
        assert datetime.fromisoformat(corpo["ultima_vez_visto"]) == visto_em.replace(
            microsecond=visto_em.microsecond
        )
        assert sessao.scalar(select(func.count()).select_from(Avistamento)) == 1
        assert [log.acao for log in acoes(sessao)][-1] == "AVISTAMENTO_REGISTRADO"

    def test_avistamento_no_futuro_e_recusado(self, cliente, colaborador, sessao):
        futuro = datetime.now(UTC) + timedelta(hours=1)
        resposta = cliente.post(
            PESSOAS,
            json=dados_pessoa(
                avistamento={"latitude": -22.5, "longitude": -43.1, "visto_em": futuro.isoformat()}
            ),
            headers=cabecalho(colaborador),
        )
        assert resposta.status_code == 422
        assert resposta.json()["campos"][0]["campo"] == "avistamento.visto_em"
        assert sessao.scalar(select(func.count()).select_from(Pessoa)) == 0

    def test_visualizar_gera_auditoria_so_com_ids(self, cliente, padrao, pessoa, sessao):
        cliente.get(f"{PESSOAS}/{pessoa['id']}", headers=cabecalho(padrao))
        log = acoes(sessao, "PESSOA_VISUALIZADA")[0]
        assert (log.usuario_id, log.entidade, log.entidade_id) == (
            padrao.id,
            "pessoa",
            pessoa["id"],
        )
        assert log.detalhes is None

    def test_edicao_registra_so_os_nomes_dos_campos(self, cliente, colaborador, pessoa, sessao):
        dados = dados_pessoa(apelido="Joquinha", consentimento=False)
        resposta = cliente.put(
            f"{PESSOAS}/{pessoa['id']}", json=dados, headers=cabecalho(colaborador)
        )
        assert resposta.status_code == 200
        assert resposta.json()["apelido"] == "Joquinha"
        assert resposta.json()["consentimento_em"] is None
        log = acoes(sessao, "PESSOA_EDITADA")[0]
        assert log.detalhes == {"campos": ["apelido", "consentimento"]}
        assert "Joquinha" not in str(log.detalhes)

    def test_pessoa_inexistente(self, cliente, colaborador):
        resposta = cliente.get(
            f"{PESSOAS}/00000000-0000-0000-0000-000000000000", headers=cabecalho(colaborador)
        )
        assert resposta.status_code == 404


class TestInativacao:
    def test_inativar_com_motivo_e_reativar(self, cliente, colaborador, pessoa, sessao):
        url = f"{PESSOAS}/{pessoa['id']}"
        inativa = cliente.post(
            f"{url}/inativar", json={"motivo": "Mudou de cidade"}, headers=cabecalho(colaborador)
        ).json()
        assert inativa["status"] == "INATIVA"
        assert inativa["motivo_inativacao"] == "Mudou de cidade"
        assert inativa["inativada_por"]["nome"] == "Colab Teste"

        ativa = cliente.post(f"{url}/reativar", headers=cabecalho(colaborador)).json()
        assert (ativa["status"], ativa["motivo_inativacao"], ativa["inativada_em"]) == (
            "ATIVA",
            None,
            None,
        )
        assert [log.acao for log in acoes(sessao, "PESSOA_")][-2:] == [
            "PESSOA_INATIVADA",
            "PESSOA_REATIVADA",
        ]
        assert sessao.scalar(select(func.count()).select_from(Pessoa)) == 1  # nunca exclui

    def test_inativar_sem_corpo(self, cliente, colaborador, pessoa):
        resposta = cliente.post(
            f"{PESSOAS}/{pessoa['id']}/inativar", headers=cabecalho(colaborador)
        )
        assert resposta.status_code == 200
        assert resposta.json()["motivo_inativacao"] is None

    def test_nao_inativa_duas_vezes(self, cliente, colaborador, pessoa):
        url = f"{PESSOAS}/{pessoa['id']}"
        cliente.post(f"{url}/inativar", headers=cabecalho(colaborador))
        assert cliente.post(f"{url}/inativar", headers=cabecalho(colaborador)).status_code == 409
        cliente.post(f"{url}/reativar", headers=cabecalho(colaborador))
        assert cliente.post(f"{url}/reativar", headers=cabecalho(colaborador)).status_code == 409


# --- Sugestões / aviso de duplicidade ---


class TestSugestoes:
    def test_ignora_acentos_e_acha_apelido(self, cliente, colaborador, pessoa):
        for termo in ["joao da conceicao", "CONCEIÇÃO", "joca"]:
            resposta = cliente.get(
                f"{PESSOAS}/sugestoes", params={"q": termo}, headers=cabecalho(colaborador)
            )
            assert [s["id"] for s in resposta.json()] == [pessoa["id"]], termo

    def test_tolera_erro_de_digitacao(self, cliente, colaborador, pessoa):
        resposta = cliente.get(
            f"{PESSOAS}/sugestoes", params={"q": "Conseicao"}, headers=cabecalho(colaborador)
        )
        assert [s["id"] for s in resposta.json()] == [pessoa["id"]]

    def test_nada_parecido(self, cliente, colaborador, pessoa):
        resposta = cliente.get(
            f"{PESSOAS}/sugestoes", params={"q": "Maria"}, headers=cabecalho(colaborador)
        )
        assert resposta.json() == []

    def test_minimo_de_duas_letras(self, cliente, colaborador):
        resposta = cliente.get(
            f"{PESSOAS}/sugestoes", params={"q": "j"}, headers=cabecalho(colaborador)
        )
        assert resposta.status_code == 422

    def test_pessoa_usuaria_nao_recebe_inativas(self, cliente, colaborador, padrao, pessoa):
        cliente.post(f"{PESSOAS}/{pessoa['id']}/inativar", headers=cabecalho(colaborador))
        params = {"q": "joca"}
        assert (
            cliente.get(f"{PESSOAS}/sugestoes", params=params, headers=cabecalho(padrao)).json()
            == []
        )
        colab = cliente.get(f"{PESSOAS}/sugestoes", params=params, headers=cabecalho(colaborador))
        assert colab.json()[0]["status"] == "INATIVA"


# --- Fotos (seção 3.8) ---


class TestFotos:
    def test_remove_exif_com_gps_e_corrige_a_rotacao(
        self, cliente, colaborador, pessoa, sessao, pasta_de_uploads
    ):
        conteudo = imagem(300, 200, exif=exif_com_gps(orientacao=6))
        assert b"CameraDeTeste" in conteudo
        resposta = enviar_foto(cliente, colaborador, pessoa["id"], conteudo=conteudo)
        assert resposta.status_code == 201, resposta.text

        foto = sessao.get(Foto, resposta.json()["id"])
        salvo = (pasta_de_uploads / foto.caminho).read_bytes()
        assert b"CameraDeTeste" not in salvo
        guardada = Image.open(BytesIO(salvo))
        assert not guardada.getexif()
        assert "exif" not in guardada.info
        assert guardada.size == (200, 300)  # orientação 6 = girar 90°
        assert foto.mime == "image/webp"

    def test_redimensiona_e_gera_miniatura(
        self, cliente, colaborador, pessoa, sessao, pasta_de_uploads
    ):
        resposta = enviar_foto(cliente, colaborador, pessoa["id"], conteudo=imagem(3200, 1600))
        foto = sessao.get(Foto, resposta.json()["id"])
        assert Image.open(pasta_de_uploads / foto.caminho).size == (1600, 800)
        assert Image.open(pasta_de_uploads / foto.caminho_miniatura).size == (400, 200)

    def test_aceita_png_com_transparencia(self, cliente, colaborador, pessoa):
        conteudo = imagem(formato="PNG", modo="RGBA")
        assert enviar_foto(cliente, colaborador, pessoa["id"], conteudo=conteudo).status_code == 201

    @pytest.mark.parametrize(
        ("conteudo", "mensagem"),
        [
            (b"isto nao e uma imagem", "Envie uma foto em JPG, PNG ou WEBP."),
            (imagem(formato="GIF"), "Envie uma foto em JPG, PNG ou WEBP."),
            (b"0" * (5 * 1024 * 1024 + 1), "A foto deve ter no máximo 5 MB."),
        ],
        ids=["nao-imagem", "gif", "maior-que-5mb"],
    )
    def test_recusa_formato_e_tamanho(self, cliente, colaborador, pessoa, conteudo, mensagem):
        resposta = enviar_foto(cliente, colaborador, pessoa["id"], conteudo=conteudo)
        assert resposta.status_code == 422
        assert resposta.json()["campos"] == [{"campo": "arquivo", "mensagem": mensagem}]

    def test_sem_consentimento_nao_envia(self, cliente, colaborador):
        sem = cliente.post(
            PESSOAS, json=dados_pessoa(consentimento=False), headers=cabecalho(colaborador)
        ).json()
        resposta = enviar_foto(cliente, colaborador, sem["id"], rota="foto-perfil")
        assert resposta.status_code == 422
        assert resposta.json()["codigo"] == "SEM_CONSENTIMENTO"

    def test_foto_de_perfil_substitui_a_anterior(
        self, cliente, colaborador, pessoa, sessao, pasta_de_uploads
    ):
        primeira = enviar_foto(cliente, colaborador, pessoa["id"], rota="foto-perfil").json()
        segunda = enviar_foto(cliente, colaborador, pessoa["id"], rota="foto-perfil").json()

        perfil = cliente.get(f"{PESSOAS}/{pessoa['id']}", headers=cabecalho(colaborador)).json()
        assert perfil["foto_perfil"]["id"] == segunda["id"]
        assert sessao.get(Foto, primeira["id"]) is None
        assert sorted(p.name for p in pasta_de_uploads.iterdir()) == sorted(
            [f"{segunda['id']}.webp", f"{segunda['id']}_miniatura.webp"]
        )

    def test_album_com_legenda(self, cliente, colaborador, pessoa, sessao):
        resposta = enviar_foto(cliente, colaborador, pessoa["id"], legenda="  Na praça  ")
        assert resposta.json()["legenda"] == "Na praça"
        assert resposta.json()["enviada_por"]["nome"] == "Colab Teste"
        perfil = cliente.get(f"{PESSOAS}/{pessoa['id']}", headers=cabecalho(colaborador)).json()
        assert [f["id"] for f in perfil["album"]] == [resposta.json()["id"]]
        log = acoes(sessao, "FOTO_ENVIADA")[0]
        assert log.detalhes == {"pessoa_id": pessoa["id"], "tipo": "ALBUM"}

    def test_limite_de_vinte_fotos_no_album(self, cliente, colaborador, pessoa, sessao):
        for _ in range(servico_fotos.MAXIMO_FOTOS_ALBUM):
            sessao.add(
                Foto(
                    pessoa_id=pessoa["id"],
                    tipo=TipoFoto.ALBUM,
                    caminho="x.webp",
                    caminho_miniatura="x_miniatura.webp",
                    mime="image/webp",
                    tamanho_bytes=1,
                    enviada_por_id=colaborador.id,
                )
            )
        sessao.flush()
        resposta = enviar_foto(cliente, colaborador, pessoa["id"])
        assert resposta.status_code == 422
        assert "20 fotos" in resposta.json()["campos"][0]["mensagem"]

    def test_remover_foto_de_perfil(self, cliente, colaborador, pessoa, sessao, pasta_de_uploads):
        foto = enviar_foto(cliente, colaborador, pessoa["id"], rota="foto-perfil").json()
        resposta = cliente.delete(
            f"{PESSOAS}/{pessoa['id']}/fotos/{foto['id']}", headers=cabecalho(colaborador)
        )
        assert resposta.status_code == 204
        assert sessao.get(Pessoa, pessoa["id"]).foto_perfil_id is None
        assert list(pasta_de_uploads.iterdir()) == []
        assert acoes(sessao, "FOTO_REMOVIDA")

    def test_remover_foto_de_outra_pessoa_responde_404(self, cliente, colaborador, pessoa):
        outra = cliente.post(PESSOAS, json=dados_pessoa(), headers=cabecalho(colaborador)).json()
        foto = enviar_foto(cliente, colaborador, pessoa["id"]).json()
        resposta = cliente.delete(
            f"{PESSOAS}/{outra['id']}/fotos/{foto['id']}", headers=cabecalho(colaborador)
        )
        assert resposta.status_code == 404


class TestArquivos:
    def test_url_assinada_funciona_sem_login(self, cliente, colaborador, pessoa):
        foto = enviar_foto(cliente, colaborador, pessoa["id"]).json()
        for url in (foto["url"], foto["url_miniatura"]):
            resposta = cliente.get(url)
            assert resposta.status_code == 200
            assert resposta.headers["content-type"] == "image/webp"
            assert resposta.headers["x-content-type-options"] == "nosniff"
            Image.open(BytesIO(resposta.content))

    def test_url_adulterada_ou_trocada_de_variante(self, cliente, colaborador, pessoa):
        foto = enviar_foto(cliente, colaborador, pessoa["id"]).json()
        assert cliente.get(foto["url"][:-4] + "0000").status_code == 403
        trocada = foto["url_miniatura"].replace("variante=miniatura", "variante=original")
        assert cliente.get(trocada).status_code == 403

    def test_url_expirada(self, cliente, colaborador, pessoa):
        foto = enviar_foto(cliente, colaborador, pessoa["id"]).json()
        consulta = parse_qs(urlparse(foto["url"]).query)
        expira = int(consulta["exp"][0])
        assert 3600 <= expira - datetime.now(UTC).timestamp() <= 3600 + 600 + 5

        from app.services.arquivos import url_assinada

        antiga = url_assinada(foto["id"], "original", agora=datetime.now(UTC) - timedelta(hours=2))
        assert cliente.get(antiga).status_code == 403

    def test_foto_removida_responde_404(self, cliente, colaborador, pessoa):
        foto = enviar_foto(cliente, colaborador, pessoa["id"]).json()
        cliente.delete(
            f"{PESSOAS}/{pessoa['id']}/fotos/{foto['id']}", headers=cabecalho(colaborador)
        )
        assert cliente.get(foto["url"]).status_code == 404


def test_pessoa_status_padrao_e_ativa(sessao, colaborador):
    pessoa = Pessoa(nome="A", sobrenome="B", consentimento=False, cadastrada_por_id=colaborador.id)
    sessao.add(pessoa)
    sessao.flush()
    assert pessoa.status == StatusPessoa.ATIVA

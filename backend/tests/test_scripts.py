import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.seguranca import verificar_senha
from app.entities import (
    Avistamento,
    Foto,
    PerfilUsuario,
    Pessoa,
    StatusPessoa,
    StatusUsuario,
    Usuario,
)
from app.scripts.criar_admin import SenhaFracaError, criar_admin
from app.scripts.seed_dev import (
    LIMITES_PETROPOLIS,
    QUANTIDADE_PESSOAS,
    BancoJaPopuladoError,
    popular,
)


class TestCriarAdmin:
    def test_cria_admin_ativo_com_senha_argon2(self, sessao: Session):
        usuario, criado = criar_admin(sessao, "  Admin@Aurora.Local ", "SenhaForte1")
        assert criado
        assert usuario.email == "admin@aurora.local"
        assert usuario.perfil == PerfilUsuario.ADMIN
        assert usuario.status == StatusUsuario.ATIVO
        assert usuario.senha_hash.startswith("$argon2")
        assert verificar_senha("SenhaForte1", usuario.senha_hash)
        assert not verificar_senha("outra-senha1", usuario.senha_hash)

    def test_nao_duplica_nem_altera_conta_existente(self, sessao: Session):
        primeiro, _ = criar_admin(sessao, "admin@aurora.local", "SenhaForte1")
        segundo, criado = criar_admin(sessao, "ADMIN@aurora.local", "OutraSenha2")
        assert not criado
        assert segundo.id == primeiro.id
        assert verificar_senha("SenhaForte1", segundo.senha_hash)
        total = sessao.scalar(select(func.count()).select_from(Usuario))
        assert total == 1

    @pytest.mark.parametrize("senha", ["curta1", "semnumeros", "12345678"])
    def test_recusa_senha_fraca(self, sessao: Session, senha: str):
        with pytest.raises(SenhaFracaError):
            criar_admin(sessao, "admin@aurora.local", senha)


class TestSeedDev:
    def test_cria_pessoas_e_avistamentos_ficticios(self, sessao: Session):
        resumo = popular(sessao)

        assert resumo.pessoas == QUANTIDADE_PESSOAS
        assert sessao.scalar(select(func.count()).select_from(Pessoa)) == QUANTIDADE_PESSOAS
        total_avistamentos = sessao.scalar(select(func.count()).select_from(Avistamento))
        assert total_avistamentos == resumo.avistamentos
        assert 200 <= total_avistamentos <= 400
        # Nunca usar fotos: a interface mostra avatares com iniciais.
        assert sessao.scalar(select(func.count()).select_from(Foto)) == 0

    def test_ultima_localizacao_espelha_o_avistamento_mais_recente(self, sessao: Session):
        popular(sessao)
        for pessoa in sessao.scalars(select(Pessoa)):
            mais_recente = sessao.scalars(
                select(Avistamento)
                .where(Avistamento.pessoa_id == pessoa.id)
                .order_by(Avistamento.visto_em.desc())
                .limit(1)
            ).one()
            assert pessoa.ultima_vez_visto == mais_recente.visto_em
            assert pessoa.ultima_latitude == mais_recente.latitude
            assert pessoa.ultima_longitude == mais_recente.longitude
            assert pessoa.ultimo_endereco == mais_recente.endereco

    def test_avistamentos_ficam_em_petropolis_e_no_passado(self, sessao: Session):
        popular(sessao)
        limites = LIMITES_PETROPOLIS
        fora = sessao.scalar(
            select(func.count())
            .select_from(Avistamento)
            .where(
                ~Avistamento.latitude.between(limites["lat_min"], limites["lat_max"])
                | ~Avistamento.longitude.between(limites["lng_min"], limites["lng_max"])
                | (Avistamento.visto_em > func.now())
            )
        )
        assert fora == 0

    def test_registros_sao_feitos_por_contas_ativas_que_podem_registrar(self, sessao: Session):
        popular(sessao)
        perfis = set(
            sessao.scalars(
                select(Usuario.perfil)
                .join(Avistamento, Avistamento.registrado_por_id == Usuario.id)
                .where(Usuario.status == StatusUsuario.ATIVO)
                .distinct()
            )
        )
        assert perfis <= {PerfilUsuario.ADMIN, PerfilUsuario.COLABORADOR}
        sem_status_ativo = sessao.scalar(
            select(func.count())
            .select_from(Avistamento)
            .join(Usuario, Avistamento.registrado_por_id == Usuario.id)
            .where(Usuario.status != StatusUsuario.ATIVO)
        )
        assert sem_status_ativo == 0

    def test_inativas_tem_motivo_e_data(self, sessao: Session):
        popular(sessao)
        for pessoa in sessao.scalars(select(Pessoa).where(Pessoa.status == StatusPessoa.INATIVA)):
            assert pessoa.motivo_inativacao
            assert pessoa.inativada_em is not None
            assert pessoa.inativada_por_id is not None

    def test_cria_contas_de_teste_de_todos_os_status(self, sessao: Session):
        popular(sessao)
        status = set(sessao.scalars(select(Usuario.status).distinct()))
        assert status == {StatusUsuario.ATIVO, StatusUsuario.PENDENTE, StatusUsuario.INATIVO}

    def test_recusa_rodar_em_banco_com_pessoas(self, sessao: Session):
        popular(sessao)
        with pytest.raises(BancoJaPopuladoError):
            popular(sessao)

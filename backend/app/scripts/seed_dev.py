"""Popula o banco de DESENVOLVIMENTO com dados fictícios.

Cria contas de teste (uma por perfil e status), ~30 pessoas em situação de rua e ~300
avistamentos espalhados por bairros de Petrópolis. Todos os dados são inventados (Faker pt_BR)
e não há fotos: a interface mostra avatares com iniciais.

Uso: cd backend && python -m app.scripts.seed_dev
"""

import random
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from faker import Faker
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.seguranca import gerar_hash_senha
from app.db.sessao import SessaoLocal
from app.entities import (
    Avistamento,
    PerfilUsuario,
    Pessoa,
    StatusPessoa,
    StatusUsuario,
    Usuario,
)
from app.schemas.comum import digitos_verificadores_cpf

SEMENTE = 42
SENHA_CONTAS_TESTE = "Senha12345"
QUANTIDADE_PESSOAS = 30
AVISTAMENTOS_POR_PESSOA = (4, 16)  # média ≈ 10 → ~300 no total
DIAS_DE_HISTORICO = 120


@dataclass(frozen=True)
class Bairro:
    nome: str
    latitude: float
    longitude: float


# Centros aproximados de bairros de Petrópolis/RJ.
BAIRROS = [
    Bairro("Centro", -22.5050, -43.1790),
    Bairro("Valparaíso", -22.5150, -43.1900),
    Bairro("Quitandinha", -22.5270, -43.2120),
    Bairro("Bingen", -22.5080, -43.2050),
    Bairro("Coronel Veiga", -22.5260, -43.1830),
    Bairro("Alto da Serra", -22.5150, -43.1680),
    Bairro("Mosela", -22.4900, -43.1950),
    Bairro("Retiro", -22.4950, -43.1700),
    Bairro("Itamarati", -22.4850, -43.1500),
    Bairro("Corrêas", -22.4450, -43.1400),
]

# Limites usados também nos testes: todos os pontos gerados ficam dentro desta área.
LIMITES_PETROPOLIS = {"lat_min": -22.56, "lat_max": -22.41, "lng_min": -43.25, "lng_max": -43.10}

APELIDOS = [
    "Zé", "Tião", "Galego", "Mineiro", "Baixinho", "Tico", "Juca", "Chico", "Didi", "Tuca",
    "Lia", "Nina", "Bia", "Cacá", "Biju", "Dona Cida", "Seu Toninho", "Professor", "Paraíba",
]  # fmt: skip

OBSERVACOES = [
    "Prefere atendimento pela manhã.",
    "Costuma estar acompanhada de um cachorro.",
    "Pediu ajuda para emitir segunda via de documentos.",
    "Aceita encaminhamento para o Centro POP.",
    "Precisa de cobertor nos meses de inverno.",
    "Faz acompanhamento na unidade de saúde do bairro.",
]

MOTIVOS_INATIVACAO = [
    "Retornou para a casa da família.",
    "Acolhida em instituição de longa permanência.",
]

CONTAS_TESTE = [
    ("Colaboradora de Teste", "colaboradora@projetoaurora.local", PerfilUsuario.COLABORADOR,
     StatusUsuario.ATIVO),
    ("Colaborador de Teste", "colaborador@projetoaurora.local", PerfilUsuario.COLABORADOR,
     StatusUsuario.ATIVO),
    ("Pessoa Usuária de Teste", "usuaria@projetoaurora.local", PerfilUsuario.PADRAO,
     StatusUsuario.ATIVO),
    ("Cadastro Pendente Um", "pendente1@projetoaurora.local", PerfilUsuario.PADRAO,
     StatusUsuario.PENDENTE),
    ("Cadastro Pendente Dois", "pendente2@projetoaurora.local", PerfilUsuario.PADRAO,
     StatusUsuario.PENDENTE),
    ("Conta Inativa de Teste", "inativa@projetoaurora.local", PerfilUsuario.PADRAO,
     StatusUsuario.INATIVO),
]  # fmt: skip

# Endereço do próprio projeto (rodapé), igual para todas as contas de teste.
ENDERECO_CONTAS_TESTE = {
    "cep": "25651-000",
    "logradouro": "Rua Afrânio de Melo Franco",
    "numero": "333",
    "bairro": "Quitandinha",
    "cidade": "Petrópolis",
    "uf": "RJ",
}


class BancoJaPopuladoError(RuntimeError):
    pass


@dataclass
class ResumoSeed:
    usuarios: int
    pessoas: int
    avistamentos: int


def _coordenada(valor: float) -> Decimal:
    return Decimal(f"{valor:.6f}")


def _telefone(aleatorio: random.Random) -> str:
    return f"(24) 9{aleatorio.randint(8000, 9999)}-{aleatorio.randint(0, 9999):04d}"


def _cpf(aleatorio: random.Random) -> str:
    """CPF fictício com dígitos verificadores válidos (só os 11 dígitos)."""
    base = "".join(str(aleatorio.randint(0, 9)) for _ in range(9))
    return base + digitos_verificadores_cpf(base + "00")


def _criar_contas(sessao: Session) -> list[Usuario]:
    """Cria as contas de teste que ainda não existem e devolve as que podem registrar dados."""
    senha_hash = gerar_hash_senha(SENHA_CONTAS_TESTE)
    aleatorio = random.Random(SEMENTE)
    for nome, email, perfil, status in CONTAS_TESTE:
        if sessao.scalar(select(Usuario).where(Usuario.email == email)) is None:
            sessao.add(
                Usuario(
                    nome=nome,
                    email=email,
                    senha_hash=senha_hash,
                    perfil=perfil,
                    status=status,
                    email_verificado_em=datetime.now(UTC),
                    sobrenome="Fictícia",
                    cpf=_cpf(aleatorio),
                    telefone=_telefone(aleatorio),
                    **ENDERECO_CONTAS_TESTE,
                )
            )
    sessao.flush()
    return list(
        sessao.scalars(
            select(Usuario).where(
                Usuario.status == StatusUsuario.ATIVO,
                Usuario.perfil.in_([PerfilUsuario.ADMIN, PerfilUsuario.COLABORADOR]),
            )
        )
    )


def popular(sessao: Session, semente: int = SEMENTE) -> ResumoSeed:
    """Insere os dados fictícios (sem commit). Recusa se já houver pessoas cadastradas."""
    if sessao.scalar(select(func.count()).select_from(Pessoa)):
        raise BancoJaPopuladoError(
            "Já existem pessoas cadastradas. O seed só roda em banco sem pessoas."
        )

    aleatorio = random.Random(semente)
    fake = Faker("pt_BR")
    fake.seed_instance(semente)
    agora = datetime.now(UTC)

    registradores = _criar_contas(sessao)
    total_avistamentos = 0

    for _ in range(QUANTIDADE_PESSOAS):
        cadastrada_por = aleatorio.choice(registradores)
        bairros_frequentes = aleatorio.sample(BAIRROS, k=aleatorio.choice([1, 2, 2, 3]))
        consentimento = aleatorio.random() < 0.7
        inicio = agora - timedelta(days=aleatorio.randint(30, DIAS_DE_HISTORICO))

        pessoa = Pessoa(
            nome=fake.first_name(),
            sobrenome=fake.last_name(),
            apelido=aleatorio.choice(APELIDOS) if aleatorio.random() < 0.6 else None,
            idade_aproximada=aleatorio.randint(18, 80) if aleatorio.random() < 0.8 else None,
            telefone=_telefone(aleatorio) if aleatorio.random() < 0.2 else None,
            nome_contato=fake.name() if aleatorio.random() < 0.3 else None,
            observacoes=aleatorio.choice(OBSERVACOES) if aleatorio.random() < 0.5 else None,
            consentimento=consentimento,
            consentimento_em=inicio if consentimento else None,
            cadastrada_por_id=cadastrada_por.id,
            criado_em=inicio,
        )
        if pessoa.nome_contato:
            pessoa.telefone_contato = _telefone(aleatorio)
        sessao.add(pessoa)
        sessao.flush()

        avistamentos = []
        for _ in range(aleatorio.randint(*AVISTAMENTOS_POR_PESSOA)):
            bairro = aleatorio.choice(bairros_frequentes)
            # Espalha até ~400 m em volta do centro do bairro.
            latitude = bairro.latitude + aleatorio.uniform(-0.0036, 0.0036)
            longitude = bairro.longitude + aleatorio.uniform(-0.0036, 0.0036)
            visto_em = inicio + (agora - inicio) * aleatorio.random()
            avistamentos.append(
                Avistamento(
                    pessoa_id=pessoa.id,
                    latitude=_coordenada(latitude),
                    longitude=_coordenada(longitude),
                    endereco=f"{bairro.nome}, Petrópolis - RJ",
                    visto_em=visto_em,
                    registrado_por_id=aleatorio.choice(registradores).id,
                )
            )
        sessao.add_all(avistamentos)
        total_avistamentos += len(avistamentos)

        mais_recente = max(avistamentos, key=lambda a: a.visto_em)
        pessoa.ultima_vez_visto = mais_recente.visto_em
        pessoa.ultima_latitude = mais_recente.latitude
        pessoa.ultima_longitude = mais_recente.longitude
        pessoa.ultimo_endereco = mais_recente.endereco

        if aleatorio.random() < 0.1:
            pessoa.status = StatusPessoa.INATIVA
            pessoa.motivo_inativacao = aleatorio.choice(MOTIVOS_INATIVACAO)
            pessoa.inativada_em = mais_recente.visto_em + timedelta(days=1)
            pessoa.inativada_por_id = cadastrada_por.id

    sessao.flush()
    return ResumoSeed(
        usuarios=sessao.scalar(select(func.count()).select_from(Usuario)) or 0,
        pessoas=QUANTIDADE_PESSOAS,
        avistamentos=total_avistamentos,
    )


def main() -> int:
    try:
        with SessaoLocal() as sessao:
            resumo = popular(sessao)
            sessao.commit()
    except BancoJaPopuladoError as erro:
        print(f"Nada foi feito: {erro}")
        return 1

    print(
        f"Dados fictícios criados: {resumo.pessoas} pessoas e {resumo.avistamentos} avistamentos "
        f"({resumo.usuarios} contas no banco)."
    )
    print(f"Contas de teste (senha {SENHA_CONTAS_TESTE}):")
    for _nome, email, perfil, status in CONTAS_TESTE:
        print(f"  {email:36} {perfil.value:12} {status.value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

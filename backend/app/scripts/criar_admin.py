"""Cria a primeira pessoa administradora com ADMIN_EMAIL e ADMIN_SENHA do .env.

Uso: cd backend && python -m app.scripts.criar_admin
"""

import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import obter_configuracoes
from app.core.seguranca import gerar_hash_senha, normalizar_email, senha_atende_requisitos
from app.db.sessao import SessaoLocal
from app.entities import PerfilUsuario, StatusUsuario, Usuario

NOME_PADRAO = "Pessoa administradora"
SENHA_DE_EXEMPLO = "TroqueEstaSenha1"


class SenhaFracaError(ValueError):
    pass


def criar_admin(
    sessao: Session, email: str, senha: str, nome: str = NOME_PADRAO
) -> tuple[Usuario, bool]:
    """Cria a conta ADMIN/ATIVO. Se o email já existir, não altera nada e devolve (conta, False)."""
    if not senha_atende_requisitos(senha):
        raise SenhaFracaError(
            "ADMIN_SENHA precisa ter ao menos 8 caracteres, com pelo menos uma letra e um número."
        )

    email = normalizar_email(email)
    existente = sessao.scalar(select(Usuario).where(Usuario.email == email))
    if existente is not None:
        return existente, False

    usuario = Usuario(
        nome=nome,
        email=email,
        senha_hash=gerar_hash_senha(senha),
        perfil=PerfilUsuario.ADMIN,
        status=StatusUsuario.ATIVO,
    )
    sessao.add(usuario)
    sessao.flush()
    return usuario, True


def main() -> int:
    configuracoes = obter_configuracoes()
    if configuracoes.ADMIN_SENHA == SENHA_DE_EXEMPLO:
        print("Atenção: ADMIN_SENHA ainda é a senha de exemplo. Troque-a no .env.")

    try:
        with SessaoLocal() as sessao:
            usuario, criado = criar_admin(
                sessao, configuracoes.ADMIN_EMAIL, configuracoes.ADMIN_SENHA
            )
            sessao.commit()
    except SenhaFracaError as erro:
        print(f"Erro: {erro}")
        return 1

    if criado:
        print(f"Pessoa administradora criada: {usuario.email}")
    else:
        print(
            f"Já existe uma conta com o email {usuario.email} "
            f"(perfil {usuario.perfil.value}, status {usuario.status.value}). Nada foi alterado."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())

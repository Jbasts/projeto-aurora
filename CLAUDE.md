# Projeto Aurora — Plataforma BIOMOB

Plataforma web (mobile-first) para cadastro e mapeamento de pessoas em situação de rua (PSDR) em Petrópolis/RJ, para apoiar ações de ajuda humanitária.

**Antes de qualquer tarefa, leia `docs/ESPECIFICACAO.md`** (regras de negócio, permissões, modelo de dados, API, telas e fases).
Os protótipos estão em `docs/telas.pdf` (uma tela por página; identifique cada uma pelo título da página, conforme a seção 4.1 da especificação). Eles são referência visual. Quando contradizem a especificação, **a especificação vale** — várias telas ainda têm campos e dados de template, e as melhorias descritas na especificação já foram aprovadas.

## Stack
- Backend: Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, PostgreSQL 16
- Frontend: React + Vite + TypeScript, React Router, TanStack Query, react-hook-form + zod, Tailwind CSS, react-leaflet + leaflet.heat (OpenStreetMap)
- Dev: PostgreSQL 16 instalado localmente (serviço `postgresql-x64-16`, banco `projeto-aurora`, usuário `postgres`), Mailpit via Podman Compose, pytest, Vitest, Ruff, ESLint + Prettier

## Comandos
(Mantenha esta seção atualizada conforme o projeto evoluir.)
- Configuração inicial: copiar `backend/.env.example` para `backend/.env` e preencher a senha do banco; `cd backend && py -3.12 -m venv .venv && .venv\Scripts\pip install -r requirements.txt`; `cd frontend && npm install`
- Email de teste: `podman machine start` (uma vez por sessão) e `podman compose up -d` (Mailpit em http://localhost:8025)
- Backend (venv em `backend/.venv`; use `.venv\Scripts\` antes dos comandos ou ative o venv): `cd backend && alembic upgrade head && uvicorn app.main:app --reload` (API em http://localhost:8000/api/v1, docs em /docs)
- Primeiro admin: `cd backend && python -m app.scripts.criar_admin`
- Dados fictícios: `cd backend && python -m app.scripts.seed_dev` (só roda com o banco sem pessoas; cria contas de teste `*@projetoaurora.local` com senha `Senha12345`)
- Nova migração: `cd backend && alembic revision --autogenerate -m "descricao"` (revise o arquivo gerado; a função `texto_busca_pessoa` e o índice `ix_pessoas_busca_trgm` são mantidos à mão)
- Testes backend: `cd backend && pytest` (usa o banco `projeto-aurora_teste`, criado e migrado automaticamente; cada teste roda numa transação desfeita no fim)
- Lint backend: `cd backend && ruff check . && ruff format --check .`
- Frontend: `cd frontend && npm run dev` (http://localhost:5173; `/api` é redirecionado para o backend na porta 8000)
- Testes frontend: `cd frontend && npm test`
- Lint e tipos do frontend: `cd frontend && npm run lint && npm run typecheck`

## Regras de trabalho
- Trabalhe **uma fase por vez** (seção "Fases" da especificação). Não implemente nada fora da fase pedida.
- Em caso de dúvida ou conflito entre tela e especificação, pergunte antes de decidir.
- Permissões são sempre verificadas no backend; o frontend apenas esconde o que a pessoa não pode usar.
- Toda mudança no banco é feita por migração Alembic.
- Ao terminar uma fase: rode lint e testes, resuma o que foi feito, liste pendências e explique como testar manualmente.

## Convenções
- Domínio em português: tabelas, campos, rotas da API e pastas de feature (`pessoas`, `avistamentos`, `ultima_vez_visto`).
- Textos da interface em pt-BR. Use sempre "pessoa(s) em situação de rua" — nunca "morador de rua" ou "mendigo".
- Backend: routers finos, regras de negócio em `services/`, permissões pela dependência `exigir_perfil(...)`.
- Frontend: chamadas à API via TanStack Query; validações com zod espelhando as do backend; cores, espaçamentos e fontes só por tokens (CSS variables).
- Nunca registrar dados pessoais de PSDR nos logs da aplicação (somente IDs).
- Dados de desenvolvimento são sempre fictícios; nunca usar fotos de pessoas reais em seeds (use avatares com iniciais).

## Estrutura
```
/
├── CLAUDE.md
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── ESPECIFICACAO.md
│   └── telas.pdf         # protótipos (uma tela por página)
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/             # Configuração, segurança e permissões
│   │   ├── db/               # Conexão, sessão e base do banco
│   │   ├── routes/           # Endpoints e configuração HTTP
│   │   ├── controllers/      # Coordenação das chamadas da API
│   │   ├── services/         # Regras de negócio
│   │   ├── repositories/     # Consultas e persistência no banco
│   │   ├── entities/         # Modelos ORM das tabelas
│   │   ├── schemas/          # Validação de entrada e formatos de saída
│   │   ├── emails/           # Templates de e-mail
│   │   └── scripts/          # Criar administrador e dados de teste
│   ├── alembic/              # Migrações do banco
│   ├── tests/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    └── src/
        ├── api/              # Cliente HTTP e configuração da API
        ├── assets/           # Imagens, ícones e fontes
        ├── components/       # Componentes compartilhados
        ├── contexts/         # Estados globais compartilhados
        ├── features/         # Funcionalidades organizadas por domínio
        ├── hooks/            # Hooks compartilhados
        ├── routes/           # Rotas e proteção de navegação
        ├── styles/           # Estilos globais e tokens
        └── pages/            # Páginas associadas às rotas
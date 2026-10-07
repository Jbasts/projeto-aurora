# Projeto Aurora — Plataforma BIOMOB

Plataforma web (mobile-first) para cadastro e mapeamento de **pessoas em situação de rua** em
Petrópolis/RJ, para apoiar ações de ajuda humanitária. Pessoas colaboradoras cadastram as pessoas,
registram no mapa onde e quando as viram (avistamentos) e acompanham por onde elas circulam com
mapas de calor.

A especificação completa (regras de negócio, permissões, modelo de dados, API e telas) está em
[`docs/ESPECIFICACAO.md`](docs/ESPECIFICACAO.md). Os protótipos de referência estão em
`docs/telas.pdf`.

## Funcionalidades

- **Contas e acesso**: cadastro com aprovação por uma pessoa administradora, login com bloqueio
  após tentativas erradas, recuperação de senha por email e três perfis de acesso (pessoa
  administradora, colaboradora e usuária).
- **Pessoas em situação de rua**: cadastro em 3 etapas com aviso de nomes parecidos, edição,
  inativação/reativação (nunca exclusão), foto de perfil e álbum (com consentimento e sem
  metadados EXIF).
- **Busca** sem diferenciar acentos, com filtros e paginação (5 por página, ajustável até 100).
- **Mapa** (OpenStreetMap) com a última localização de cada pessoa, registro de avistamentos por
  clique ou GPS e visualização em lista.
- **Mapa de calor** geral (filtros por pessoa e período) e individual no perfil, com o histórico
  de avistamentos.
- **Auditoria**: logins, alterações de usuários e ações sobre os cadastros, inclusive cada
  visualização de perfil; consulta pela pessoa administradora.
- **Acessibilidade** (meta WCAG 2.1 AA): ouvir página, Libras (VLibras), tamanho do texto, modo
  escuro, navegação por teclado e alternativa em lista para o mapa.
- **PWA**: pode ser instalada no celular ("Instalar app").

## Stack

| Parte    | Tecnologias                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, PostgreSQL 16                                                            |
| Frontend | React + Vite + TypeScript, React Router, TanStack Query, react-hook-form + zod, Tailwind CSS, Leaflet + leaflet.heat, vite-plugin-pwa |
| Dev      | Mailpit (Podman/Docker Compose), pytest, Vitest, axe-core, Ruff, ESLint + Prettier                                                   |

## Requisitos

- Python 3.12
- Node.js 20 ou superior
- PostgreSQL 16 com um banco `projeto-aurora` (as extensões `citext`, `unaccent` e `pg_trgm` são
  criadas pela migração)
- Podman ou Docker, para o Mailpit (emails de teste)

## Como rodar em desenvolvimento

1. **Configuração**

   ```sh
   # Backend
   cp backend/.env.example backend/.env      # preencha a senha do banco e troque os segredos
   cd backend
   py -3.12 -m venv .venv
   .venv\Scripts\pip install -r requirements.txt

   # Frontend
   cd frontend
   npm install
   ```

2. **Email de teste** (Mailpit em http://localhost:8025)

   ```sh
   podman machine start      # uma vez por sessão (só no Podman)
   podman compose up -d
   ```

3. **Banco, primeiro admin e dados fictícios**

   ```sh
   cd backend
   .venv\Scripts\alembic upgrade head
   .venv\Scripts\python -m app.scripts.criar_admin      # usa ADMIN_EMAIL e ADMIN_SENHA do .env
   .venv\Scripts\python -m app.scripts.seed_dev         # opcional
   ```

   O `seed_dev` só roda com o banco sem pessoas. Ele cria ~30 pessoas e ~300 avistamentos
   fictícios (sem fotos reais) e contas de teste `*@projetoaurora.local` com a senha `Senha12345`.

4. **Servidores**

   ```sh
   cd backend && .venv\Scripts\uvicorn app.main:app --reload   # API: http://localhost:8000/api/v1 (docs em /docs)
   cd frontend && npm run dev                                   # App: http://localhost:5173
   ```

   O Vite encaminha `/api` para o backend na porta 8000.

## Testes e qualidade

```sh
# Backend (usa o banco "projeto-aurora_teste", criado e migrado automaticamente)
cd backend
.venv\Scripts\pytest
.venv\Scripts\ruff check . && .venv\Scripts\ruff format --check .

# Frontend
cd frontend
npm test                          # Vitest, incluindo a revisão de acessibilidade com axe-core
npm run lint && npm run typecheck
npm run build                     # build de produção com service worker
```

## PWA

- O service worker só existe no build de produção (`npm run build` e depois `npm run preview`).
- Ele guarda em cache apenas o app (HTML, JS, CSS e imagens). **A API nunca vai para o cache**,
  para que dados das pessoas cadastradas não fiquem no aparelho.
- Ícones: gerados a partir de `frontend/public/favicon.svg` com `npm run gerar-icones`
  (configuração em `frontend/pwa-assets.config.ts`).

## Estrutura

```
backend/
  app/
    routes/         endpoints (finos)
    controllers/    coordenação das chamadas
    services/       regras de negócio
    repositories/   consultas ao banco
    entities/       modelos ORM
    schemas/        entrada e saída da API (Pydantic)
    core/           configuração, segurança e permissões
    scripts/        criar_admin e seed_dev
  alembic/          migrações
  tests/
frontend/
  src/
    api/            cliente HTTP
    components/     componentes compartilhados (layout, mapa, formulários)
    features/       código por domínio (pessoas, mapa, usuarios, auditoria…)
    pages/          páginas e testes por fase
    routes/         rotas e proteção por perfil
    styles/         tokens de design (CSS variables)
docs/               especificação e protótipos
```

## Convenções

- Domínio em português: tabelas, campos, rotas da API e pastas.
- Na interface, sempre "pessoa(s) em situação de rua".
- Permissões são verificadas no backend; o frontend só esconde o que a pessoa não pode usar.
- Toda mudança no banco é feita por migração Alembic.
- Os logs da aplicação nunca têm dados pessoais das pessoas cadastradas (só IDs).
- Dados de desenvolvimento são sempre fictícios; nunca use fotos de pessoas reais.

Mais detalhes para quem desenvolve estão em [`CLAUDE.md`](CLAUDE.md).

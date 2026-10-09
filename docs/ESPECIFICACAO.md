# Especificação — Projeto Aurora (BIOMOB)

## 1. Visão geral

Plataforma para cadastro e mapeamento de pessoas em situação de rua (PSDR) em Petrópolis/RJ. Pessoas colaboradoras cadastram as PSDR, registram no mapa onde e quando as viram (avistamentos) e acompanham por onde elas circulam com mapas de calor, para direcionar ajuda humanitária.

Uso principal: celular, em campo. Uso secundário: computador, para gestão.

### Glossário
- **PSDR**: pessoa em situação de rua. Na interface, sempre escrito por extenso.
- **Avistamento**: registro de que uma PSDR foi vista em um ponto do mapa, em uma data e hora.
- **Última localização / visto por último**: dados do avistamento mais recente da pessoa.
- **Perfil de acesso**: `ADMIN`, `COLABORADOR`, `PADRAO`. Rótulos na interface: "Pessoa administradora", "Pessoa colaboradora", "Pessoa usuária". Na interface o campo se chama "Perfil de acesso" (não "Cargo").

## 2. Perfis e permissões

| Funcionalidade | ADMIN | COLABORADOR | PADRAO |
|---|---|---|---|
| Home e Meu perfil | sim | sim | sim |
| Buscar PSDR e ver perfil da PSDR | sim | sim | sim (somente ativas) |
| Ver mapa e mapa de calor | sim | sim | sim |
| Cadastrar, editar, inativar e reativar PSDR | sim | sim | não |
| Enviar e remover fotos | sim | sim | não |
| Registrar avistamento | sim | sim | não |
| Listar, aprovar e inativar usuários; ver todos os dados de uma conta | sim | não | não |
| Decidir solicitações de troca de email e CPF | sim | não | não |
| Alterar o perfil de acesso (Permissões) | sim | não | não |
| Ver logs de auditoria | sim | não | não |

O backend valida a permissão em toda rota. O frontend esconde menus, cards e botões que o perfil não pode usar e redireciona para `/acesso-negado` se a pessoa abrir uma rota proibida.

## 3. Regras de negócio

### 3.1 Login
1. Campos: "Email ou CPF" (`login` na API) e senha. Com `@`, é email (normalizado: sem espaços, minúsculas); senão, CPF com ou sem pontuação (11 dígitos). Qualquer outro texto é tratado como conta inexistente.
2. O backend busca o usuário pelo email ou pelo CPF. Se não existir, executa uma verificação de hash "falsa" (para o tempo de resposta ser parecido) e responde `CREDENCIAIS_INVALIDAS` (401).
3. Se `bloqueado_ate` for maior que agora, responde `CONTA_BLOQUEADA` (423) com `segundos_restantes`, sem verificar a senha.
4. Senha errada: soma 1 em `tentativas_falhas` e responde `CREDENCIAIS_INVALIDAS`. Na 5ª falha seguida, define `bloqueado_ate = agora + 5 min`, zera o contador e responde `CONTA_BLOQUEADA`.
5. Senha certa: zera o contador; se o email ainda não foi confirmado → `EMAIL_NAO_VERIFICADO` (403, a tela oferece reenviar o link); senão verifica o status — `PENDENTE` → `CONTA_PENDENTE` (403); `INATIVO` → `CONTA_INATIVA` (403); `ATIVO` → login concluído.
6. A mensagem de credenciais inválidas é sempre "Email, CPF ou senha incorretos." — nunca indicar o que está errado.
7. Na tela, `CONTA_BLOQUEADA` mostra o alerta "Muitas tentativas. Tente novamente em 4:32" com contagem regressiva, e o botão Entrar fica desabilitado até zerar.
8. Limites configuráveis por variável de ambiente (`MAX_TENTATIVAS_LOGIN=5`, `MINUTOS_BLOQUEIO=5`).

### 3.2 Sessão
- Access token JWT (30 min) enviado em `Authorization: Bearer`, guardado em memória no frontend.
- Refresh token (7 dias) em cookie `httpOnly`, `SameSite=Strict`, `Secure` em produção. `POST /auth/refresh` renova o access token; ao recarregar a página, o frontend chama o refresh.
- Perfil e status são lidos do banco a cada requisição autenticada, para que mudanças feitas pelo admin valham na hora. O refresh também recusa contas que não estejam `ATIVO`.
- Logout apaga o cookie de refresh.

### 3.3 Cadastro de conta
- Aberto a qualquer pessoa. Campos: nome*, sobrenome*, CPF*, data de nascimento*, email*, celular*, foto*, endereço (abaixo), senha*, confirmar senha*. **Não existe campo de perfil/cargo.** O formulário vai em multipart (campos + `foto`).
- Foto da conta: obrigatória no cadastro, com prévia antes de enviar; mesmas regras e tratamento da seção 3.8 (sem EXIF, WEBP, URL assinada em `GET /arquivos/contas/{id}`). Aparece no menu da conta, em Meu perfil, em Gerenciar usuários e em Dados do usuário. Contas antigas sem foto continuam entrando e veem um aviso em Meu perfil pedindo uma foto; até lá, aparecem as iniciais.
- CPF: máscara 000.000.000-00, dígitos verificadores validados (frontend e backend), guardado só com os 11 dígitos e único ("Este CPF já está cadastrado. Faça login ou recupere sua senha."). Depois do cadastro, só muda por pedido aprovado por ADMIN (seção 3.6). A própria pessoa o vê mascarado (`***.456.789-**`); só ADMIN o vê completo, em Gerenciar usuários. Nunca vai para logs nem para os detalhes da auditoria.
- Data de nascimento: campo de data (`AAAA-MM-DD` na API), não pode ser no futuro nem passar de 120 anos. A idade não é guardada: a API a calcula (`idade`, anos completos) e o formulário a mostra logo abaixo do campo enquanto a pessoa digita. Contas antigas não têm a data; ela é pedida ao salvar Meu perfil.
- Celular: obrigatório, com DDD e 9 dígitos, no formato (00) 00000-0000 (campo `telefone` na API).
- Endereço: CEP*, rua*, número* (aceita "S/N"), complemento, bairro, cidade*, UF*. Ao digitar os 8 dígitos do CEP, o frontend consulta o ViaCEP (`https://viacep.com.br/ws/{cep}/json/`, direto do navegador) e preenche rua, bairro, cidade e UF, levando o foco para o número. CEP inexistente ou ViaCEP fora do ar: aviso no campo e preenchimento manual. O backend guarda o CEP como `00000-000` e a UF em maiúsculas.
- Senha: mínimo de 8 caracteres, com pelo menos uma letra e um número. Os requisitos ficam visíveis abaixo do campo e são marcados conforme a pessoa digita.
- Email já cadastrado: "Este email já está cadastrado. Faça login ou recupere sua senha."
- A conta nasce com perfil `PADRAO`, status `PENDENTE` e email não confirmado. Depois de enviar, a pessoa vê a tela "Cadastro enviado", que pede para confirmar o email e explica que, depois, uma pessoa administradora vai liberar o acesso.
- **Confirmação de email**: o cadastro envia um email com o link `{FRONTEND_URL}/verificar-email?token=...` (token como o da seção 3.4, com validade de 24 h e uso único; um novo envio invalida os anteriores). Abrir o link confirma o email (`POST /auth/verificar-email`) e gera auditoria `EMAIL_VERIFICADO`. "Reenviar email de confirmação" (telas Cadastro enviado, Confirmar email e Login) responde sempre a mesma mensagem e tem limite de 3 envios por hora. Redefinir a senha pelo link do email também confirma o email.
- Ordem: confirmar o email → pessoa administradora aprova. Contas sem email confirmado não aparecem em Gerenciar usuários nem podem ser aprovadas (`EMAIL_NAO_VERIFICADO`). Contas criadas antes desta regra foram marcadas como confirmadas.
- Somente ADMIN altera perfil e status.

### 3.4 Recuperar senha
- **Etapa 1** (`/recuperar-senha`): campo "Email ou CPF" (`login` na API, mesma regra do login) + botão "Receber email". O link vai sempre para o email atual da conta. A resposta é sempre a mesma: "Se este email ou CPF estiver cadastrado, você vai receber no email da conta um link para criar uma nova senha." Limite de 3 pedidos por conta por hora.
- **Token**: `secrets.token_urlsafe(32)`; o banco guarda só o hash SHA-256; validade de 30 min; uso único; um novo pedido invalida os anteriores.
- **Email**: template HTML simples com a identidade do projeto e o link `{FRONTEND_URL}/redefinir-senha?token=...`. Em desenvolvimento, os emails caem no Mailpit.
- **Etapa 2** (`/redefinir-senha`): ao abrir, o frontend valida o token. Se for inválido, expirado ou já usado → tela de link expirado. Se for válido → campos nova senha e confirmar senha (mesmas regras do cadastro) + "Atualizar senha". Ao salvar: marca o token como usado, zera bloqueio e tentativas e redireciona para o login com o aviso "Senha atualizada. Faça login com a nova senha."

### 3.5 Gestão de usuários (somente ADMIN)
- Lista com busca por nome ou email e filtros por perfil e status. Pendentes aparecem primeiro, e o menu mostra um contador de pendentes.
- Ações: aprovar (PENDENTE → ATIVO, escolhendo o perfil de acesso), recusar (PENDENTE → INATIVO), inativar e reativar. Não existe exclusão.
- **Permissões** (`/permissoes`): lista de contas (busca e filtro por perfil) com "Alterar perfil" para quem já foi aprovado; cadastros pendentes mostram "Aguardando aprovação" (o perfil é escolhido na aprovação). Mesma regra do último ADMIN.
- "Ver dados" abre a tela Dados do usuário (`/usuarios/:id`), só de leitura, com todos os dados da conta: nome, sobrenome, CPF completo, data de nascimento e idade, email (e se foi confirmado), celular, endereço, perfil, status, criação e última alteração, além da foto e de uma troca de email em andamento. Cada abertura gera auditoria `USUARIO_VISUALIZADO`.
- **Contas antigas** (criadas antes de sobrenome e CPF serem obrigatórios): em Dados do usuário, "Completar dados" deixa a pessoa administradora preencher o sobrenome e o CPF **só quando estão vazios** (`PATCH /usuarios/{id}/dados`; CPF válido e único). Nada já preenchido é substituído. Auditoria `USUARIO_DADOS_COMPLETADOS` (só os nomes dos campos).
- **Solicitações** (`/solicitacoes`): trocas de email e de CPF pedidas em Meu perfil (seção 3.6). Filtros por situação (padrão: Pendentes) e tipo; cada item mostra a conta (foto e link para Dados do usuário), o valor atual e o novo (CPF completo), quando foi pedida, quando o email novo foi confirmado e, nas encerradas, quando e por quem. "Aprovar" e "Recusar" pedem confirmação num popup. Aprovada, o email ou o CPF da conta muda na hora (o email antigo fica livre para outra conta); se outra conta já tiver o valor → `EMAIL_EM_USO` / `CPF_EM_USO`; já decidida → `SOLICITACAO_ENCERRADA`. Auditoria `SOLICITACAO_APROVADA` / `SOLICITACAO_RECUSADA` (só o tipo e o id, nunca o email ou o CPF). Dados do usuário mostra as solicitações em aberto da conta, com link para Solicitações.
- **Menu da conta** (pessoa administradora): Usuários, Solicitações, Permissões e Auditoria ficam no menu que abre ao clicar no nome/foto, junto de Meu perfil e Sair, com o número de pendências (cadastros e solicitações) no botão e em cada item.
- O sistema nunca pode ficar sem ao menos um ADMIN ativo: bloquear rebaixar ou inativar o último (`ULTIMO_ADMIN`).
- Toda alteração gera registro de auditoria.
- O primeiro ADMIN é criado pelo script `criar_admin`, com `ADMIN_EMAIL` e `ADMIN_SENHA` do `.env`.

### 3.6 Meu perfil
- Para todas as pessoas logadas: ver e editar nome, sobrenome, data de nascimento (com a idade calculada), celular e endereço (todos obrigatórios; endereço com ViaCEP como no cadastro); enviar ou trocar a foto (`PUT /me/foto`); trocar senha (pede a senha atual). Email, CPF (mascarado) e perfil de acesso aparecem só para leitura; o perfil só muda pela pessoa administradora.
- **"Alterar email ou CPF"** abre um popup com "Novo email (opcional)", "Novo CPF (opcional)" e "Sua senha" (`POST /me/pedido-alteracao`; pelo menos um dos dois; senha errada → "Senha incorreta."). Dá para pedir os dois de uma vez. **Toda troca vira uma solicitação e só vale depois da aprovação de uma pessoa administradora** (seção 3.5). Até lá, o email e o CPF atuais continuam valendo (login, recuperação de senha, avisos). Uma solicitação nova substitui a que estiver em aberto do mesmo tipo. Auditoria `SOLICITACAO_CRIADA`.
  - **Email**: o novo não pode ser o atual nem o de outra conta. Primeiro, um link `{FRONTEND_URL}/confirmar-novo-email?token=...` vai para o email novo (24 h, uso único, até 3 por hora), para provar que o email é da pessoa; enquanto isso, a solicitação fica "Aguardando confirmação do email" e não aparece como pendente. Aberto o link (`POST /auth/confirmar-novo-email`, tela "Email confirmado"), a solicitação passa a pendente para a pessoa administradora (auditoria `SOLICITACAO_EMAIL_CONFIRMADO`).
  - **CPF**: o novo não pode ser o atual nem o de outra conta. Vai direto para a pessoa administradora como pendente.
  - Meu perfil mostra cada solicitação em aberto ("falta abrir o link" ou "em análise"; CPF novo mascarado) com "Cancelar troca de email" / "Cancelar troca de CPF" (`DELETE /me/troca-email`, `DELETE /me/troca-cpf`) e avisa quando uma troca é recusada.

### 3.7 Pessoas em situação de rua

| Campo | Obrigatório | Observação |
|---|---|---|
| nome | sim | |
| sobrenome | sim | |
| apelido | não | Como a pessoa é conhecida; muito usado na busca |
| idade_aproximada | não | O protótipo exibe "Idade"; muitas pessoas não sabem a data de nascimento |
| email | não | Validar formato |
| telefone | não | Máscara (00) 00000-0000 |
| nome_contato e telefone_contato | não | Pessoa de referência (familiar, assistente social etc.) |
| observacoes | não | Texto livre. Na interface: "Registre apenas o que ajuda no atendimento." |
| consentimento | sim (sim/não) | "A pessoa foi informada sobre o cadastro e autorizou o uso de fotos." Sem consentimento, não é possível enviar fotos (`SEM_CONSENTIMENTO`) |
| foto de perfil | não | |
| álbum de fotos | não | Até 20 fotos |
| cadastrada_por | automático | Usuário logado; a interface mostra o nome |
| ultima_vez_visto e última localização | automático | Vêm do avistamento mais recente |
| status | automático | `ATIVA` ao criar |

**Cadastro em 3 etapas** (layout do protótipo, botões Anterior/Próximo e indicador de etapa):
1. Dados pessoais e contato.
2. Consentimento e fotos (perfil + álbum).
3. Onde foi vista: mapa para clicar no local ou "Usar minha localização", data e hora (padrão: agora; não pode ser no futuro). Etapa opcional ("Pular por enquanto").

Ao final, mostrar "Pessoa cadastrada" e levar ao perfil dela.

**Aviso de duplicidade**: enquanto a pessoa preenche nome, sobrenome ou apelido, mostrar "Pessoas com nome parecido" (pg_trgm + unaccent), com foto e link. É só um aviso; não bloqueia o cadastro.

**Edição**: mesmos campos, em uma tela única dividida em seções.

**Inativação**: modal de confirmação com motivo opcional. Pessoa inativa não aparece no mapa nem no mapa de calor, e o perfil PADRAO não a vê. ADMIN e COLABORADOR a encontram filtrando por status e podem reativar. Nunca excluir fisicamente.

### 3.8 Fotos
- Formatos jpg, png e webp; máximo de 5 MB por arquivo.
- No upload: corrigir a rotação, **remover todos os metadados EXIF (contêm GPS)**, redimensionar para no máximo 1600 px e gerar miniatura de 400 px.
- Salvar em `UPLOAD_DIR` com nome UUID. A pasta nunca é servida publicamente: as imagens saem por `GET /api/v1/arquivos/{id}` com URL assinada (HMAC, validade de 1 h), gerada pela própria API nas respostas, para funcionar em `<img>`.
- Álbum: legenda opcional, quem enviou e quando. ADMIN e COLABORADOR podem remover uma foto (com confirmação).

### 3.9 Mapa e avistamentos
- Leaflet + tiles do OpenStreetMap (manter a atribuição visível). Centro inicial em Petrópolis (-22.505, -43.179), zoom 14.
- Um marcador por PSDR ativa, na última localização, com miniatura da foto ou iniciais. Agrupar marcadores próximos (cluster).
- Clique no marcador → painel lateral (no celular, painel inferior), como no protótipo do mapa com a pessoa selecionada: foto, nome, apelido, idade aproximada, última localização e visto por último (data e hora). **Exibir como texto, não como campos de formulário.** Botões "Ver perfil completo" e "Voltar".
- Registrar avistamento (ADMIN e COLABORADOR):
  1. Clicar num ponto do mapa (ou "Usar minha localização") → popup "Adicionar avistamento aqui".
  2. Modal com busca por nome, sobrenome ou apelido: autocomplete a partir de 2 letras, sem diferenciar acentos, mostrando foto e apelido.
  3. Data e hora (padrão: agora; não pode ser no futuro) e observação opcional.
  4. Salvar cria o avistamento. Se for o mais recente da pessoa, atualiza a última localização e o visto por último.
  5. Se a pessoa não for encontrada: botão "Cadastrar nova pessoa", que abre o cadastro com a localização já preenchida na etapa 3.
- Endereço aproximado por geocodificação reversa (Nominatim), feita pelo backend com `User-Agent` próprio, cache e no máximo 1 requisição por segundo. Se falhar, salvar só as coordenadas.
- Botão "Ver como lista": a mesma informação em tabela, como alternativa acessível.

### 3.10 Mapa de calor
- Tela própria (`/mapa-de-calor`) com leaflet.heat sobre os avistamentos das PSDR ativas.
- Filtros: pessoa (autocomplete opcional; sem filtro, mostra todas) e período (7, 30 ou 90 dias, ou intervalo personalizado; padrão de 30 dias).
- O perfil de cada pessoa também mostra um mapa de calor só com os avistamentos dela, junto do histórico em lista.

### 3.11 Auditoria e privacidade
- `logs_auditoria` registra: login (sucesso, falha e bloqueio), alterações em usuários, cadastro, edição, inativação e reativação de PSDR, envio e remoção de fotos, avistamentos, **visualização do perfil de uma PSDR**, visualização dos dados de uma conta pela pessoa administradora, solicitações de troca de email e de CPF (criação, confirmação do link e decisão) e dados completados em contas antigas.
- ADMIN consulta os logs numa tela simples com filtros (Fase 8).
- Os logs da aplicação nunca contêm dados pessoais de PSDR, apenas IDs.
- CORS restrito a `FRONTEND_URL`; rate limit nas rotas `/auth/*` (slowapi).
- Rodapé com link "Privacidade" para uma página estática que explica quais dados são coletados e para quê.

## 4. Telas

### 4.1 Protótipos de referência (`docs/telas.pdf`)

O PDF tem uma tela por página. Identifique cada uma pelo título que aparece na página (não pela ordem das páginas).

| Título na página do PDF | Tela | O que muda em relação ao protótipo |
|---|---|---|
| "Entrar" | Login | Estado de conta bloqueada com contagem regressiva |
| "Cadastrar" (com imagem à esquerda) | Cadastro de conta | Remover o campo "Cargo" |
| "Recuperar senha" com campo Email | Recuperar senha — etapa 1 | Mensagem neutra depois de enviar o email |
| "Recuperar senha" com Nova senha | Recuperar senha — etapa 2 | Requisitos da senha visíveis abaixo do campo |
| "Erro 404" | Página não encontrada | Botão "Voltar ao início" |
| "Token inválido" | Link expirado | Novo título, texto e botões conforme 4.3 |
| "Plataforma Projeto Aurora" | Home | Corrigir "m apeamento"; cards conforme perfil; trocar a foto do banner (é de outra cidade); cards com `--cor-primaria` |
| "Cadastro de pessoas em situação de rua" | Cadastro de PSDR | **Os campos do protótipo estão errados** (são de usuário). Usar só o layout e os botões Anterior/Próximo; campos e etapas conforme 3.7 |
| "Busca de dados de pessoas em situação de rua" | Buscar | **A tabela é de template** (Role, Teams, emails). Colunas conforme 4.3; total de registros correto; trocar a lixeira pela ação "Inativar" |
| "Visualizar mapeamento…" só com o mapa | Mapa | Leaflet + OpenStreetMap no lugar do Google Maps; botão "Usar minha localização" |
| "Visualizar mapeamento…" com foto e dados à esquerda | Mapa com pessoa selecionada | Dados como texto, não inputs; botão "Ver perfil completo" |

Em todas as telas logadas do protótipo: o item "Home" aparece sempre destacado no menu (deve destacar a página atual) e "Sair" é um botão verde primário (deve virar item do menu da pessoa, conforme a seção 5). Os verdes do protótipo são mais claros que os tokens da seção 5 — use os tokens.

Telas sem protótipo (seguir a mesma identidade visual): Cadastro enviado, Confirmar email, Confirmar novo email, Gerenciar usuários, Dados do usuário, Solicitações, Permissões, Meu perfil, Perfil da pessoa, Editar pessoa, Mapa de calor, Acesso negado (403), Erro inesperado (500), Privacidade e Logs de auditoria.

### 4.2 Rotas do frontend

| Rota | Tela | Acesso |
|---|---|---|
| `/login` | Login | pública |
| `/cadastro` | Cadastro de conta | pública |
| `/cadastro-enviado` | Confirmação do cadastro | pública |
| `/verificar-email?token=` | Confirmar email | pública |
| `/confirmar-novo-email?token=` | Confirmar novo email (troca de email) | pública |
| `/recuperar-senha` | Recuperar senha — etapa 1 | pública |
| `/redefinir-senha?token=` | Recuperar senha — etapa 2 | pública |
| `/link-expirado` | Token inválido | pública |
| `/privacidade` | Privacidade | pública |
| `/` | Home | logada |
| `/meu-perfil` | Meu perfil | logada |
| `/pessoas` | Buscar | logada |
| `/pessoas/nova` | Cadastro de PSDR | ADMIN, COLABORADOR |
| `/pessoas/:id` | Perfil da pessoa | logada |
| `/pessoas/:id/editar` | Editar pessoa | ADMIN, COLABORADOR |
| `/mapa` | Mapa | logada |
| `/mapa-de-calor` | Mapa de calor | logada |
| `/usuarios` | Gerenciar usuários | ADMIN |
| `/usuarios/:id` | Dados do usuário | ADMIN |
| `/solicitacoes` | Solicitações de troca de email e CPF | ADMIN |
| `/permissoes` | Permissões de acesso | ADMIN |
| `/auditoria` | Logs de auditoria | ADMIN |
| `/acesso-negado` | 403 | logada |
| `*` | 404 | — |

Pessoa logada que abre `/login` vai para `/`. Pessoa sem login que abre rota protegida vai para `/login` e, depois de entrar, volta para a rota que pediu.

### 4.3 Detalhes por tela

**Home**
- Seção "O projeto" do protótipo, com o texto corrigido: "Uma plataforma de cadastro e mapeamento de pessoas em situação de rua, facilitando a ajuda humanitária. Conectamos recursos e apoio a quem mais precisa, promovendo dignidade e esperança."
- Banner: imagem provisória de Petrópolis, fácil de trocar. Nunca usar foto de PSDR real na Home.
- Cards (ícone + texto, no estilo do protótipo):
  - Todos os perfis: "Visualizar meu cadastro", "Buscar pessoas em situação de rua", "Visualizar mapeamento", "Mapa de calor".
  - ADMIN e COLABORADOR: também "Cadastrar pessoa em situação de rua".
  - ADMIN: também "Gerenciar usuários", com contador de pendentes.

**Buscar**
- Campo de busca por nome, sobrenome ou apelido (ignora acentos e maiúsculas), com debounce.
- Filtros: "visto nos últimos" (7, 30 ou 90 dias, ou qualquer data) e status (só ADMIN e COLABORADOR).
- Colunas: foto + nome completo + apelido; status (Ativa/Inativa); última localização; visto por último; cadastrada por; ações.
- Ações por perfil: Ver (todos); Editar e Inativar/Reativar (ADMIN e COLABORADOR).
- Paginação no servidor (10, 20 ou 50 por página), total correto e ordenação por nome ou por visto por último.
- Estados de carregamento (skeleton), vazio ("Nenhuma pessoa encontrada") e erro.
- No celular, a tabela vira uma lista de cards.

**Perfil da pessoa**
- Cabeçalho com foto, nome, apelido, status, quem cadastrou e quando.
- Seções: dados e contato; última localização (minimapa) e visto por último; álbum (grade com visualização ampliada; envio para ADMIN e COLABORADOR); histórico de avistamentos (data, hora, endereço e quem registrou); mapa de calor individual.
- Ações para ADMIN e COLABORADOR: Editar, Registrar avistamento e Inativar/Reativar.

**Gerenciar usuários**
- Tabela com foto, nome completo, email e CPF, perfil, status, data de criação e ações (Ver dados, Aprovar, Recusar, Inativar/Reativar). Filtro rápido "Pendentes". O perfil de quem já foi aprovado muda em Permissões.

**Páginas de erro** (layout do protótipo, com a ilustração de ondas)
- 404: "Erro 404" / "Página não encontrada" / "A página que você está procurando não existe." + botão "Voltar ao início".
- Link expirado: "Link expirado" / "Este link não é mais válido" / "Ele expirou ou já foi usado. Solicite um novo link para redefinir sua senha." + botão "Solicitar novo link" (→ `/recuperar-senha`) e link "Voltar ao login".
- 403: "Acesso negado" / "Você não tem permissão para acessar esta página." + botão "Voltar ao início".
- 500: "Algo deu errado" / "Tente novamente em instantes." + botão "Tentar novamente".

## 5. Identidade visual e layout

### Tokens

| Token | Valor | Uso |
|---|---|---|
| `--cor-primaria` | `#1E7F6B` | Botões, links, cards da Home, títulos em destaque (≈4,9:1 com branco) |
| `--cor-primaria-hover` | `#17695A` | Hover e ativo |
| `--cor-primaria-clara` | `#36B39A` | **Só decorativo** (ondas, ícones grandes); nunca para texto ou fundo de texto |
| `--cor-fundo-topo` | `#EEF8F5` | Barra de acessibilidade e header |
| `--cor-fundo` | `#FFFFFF` | Fundo das páginas |
| `--cor-fundo-auth` | `#F7F9F8` | Login, cadastro e recuperar senha |
| `--cor-texto` | `#2E2E2E` | Texto principal |
| `--cor-texto-suave` | `#5F6368` | Textos de apoio |
| `--cor-borda-campo` | `#5B8F84` | Bordas de inputs (≥3:1 com o fundo) |
| `--cor-divisor` | `#CFE3DD` | Linhas divisórias |
| `--cor-erro` | `#B3261E` | Mensagens de erro |

- Fonte Montserrat (Google Fonts), pesos 400, 500, 600 e 700; fallback `system-ui, sans-serif`. Tamanhos sempre em `rem`.
- Títulos de página como no protótipo: texto escuro com o trecho final em verde ("Cadastro de pessoas em **situação de rua**") e um divisor abaixo.
- Raios: botões 10px, campos 8px, cards 12px.
- Ilustração de ondas em barras verticais: SVG decorativo com `aria-hidden="true"`.
- Logo "PROJETO AURORA": SVG ou texto provisório em `frontend/src/assets/logo.svg` até o arquivo oficial ser adicionado.
- Modo escuro: redefinir os tokens em `[data-tema="escuro"]`.

### Layout das telas logadas
- Barra superior: grupo "Acessibilidade" (ouvir página, Libras, A-, Aa, A+, modo escuro) à esquerda; redes sociais à direita. Remover "Baixe o App"; no lugar, botão "Instalar app" quando o navegador oferecer a instalação do PWA.
- Header: logo + navegação conforme perfil (Início, Pessoas, Cadastrar, Mapa, Mapa de calor), com o item da rota atual destacado e `aria-current="page"`. À direita, um menu com foto, nome e perfil da pessoa: para ADMIN, Usuários, Solicitações, Permissões e Auditoria (com contadores de pendências); para todos, Meu perfil e Sair. "Sair" não é botão primário.
- No celular: navegação em menu hambúrguer.
- Footer: "R. Afrânio de Melo Franco, 333 – Quitandinha – Petrópolis/RJ – CEP: 25651-000", redes sociais e link "Privacidade".

### Layout das telas de autenticação
Duas colunas, como nos protótipos: imagem com sobreposição verde e logo à esquerda, formulário à direita. No celular, a imagem vira uma faixa curta no topo.

## 6. Acessibilidade (meta: WCAG 2.1 AA)
- Libras: widget oficial VLibras (gov.br), acionado pelo ícone de mão.
- A- / Aa / A+: muda o `font-size` do `<html>` (87,5% / 100% / 112,5% / 125%) e salva a escolha em localStorage.
- Modo escuro: alterna o tema; o padrão segue `prefers-color-scheme`; a escolha é salva em localStorage.
- Ouvir página: Web Speech API (`speechSynthesis`, voz pt-BR) lê o conteúdo do `<main>`; o botão alterna entre ouvir e parar.
- Link "Pular para o conteúdo"; foco sempre visível; todo campo com `<label>`; erros ligados ao campo por `aria-describedby` e anunciados com `aria-live`; texto alternativo nas fotos ("Foto de {apelido ou nome}"); nenhuma informação transmitida só por cor; alvos de toque com no mínimo 44×44 px.
- Mapa: controles acessíveis por teclado e alternativa em lista.

## 7. Modelo de dados (PostgreSQL)

Extensões: `citext`, `unaccent`, `pg_trgm`. IDs em UUID. Datas em `timestamptz` (UTC no banco, exibidas em America/Sao_Paulo).

**usuarios**
- id, nome, sobrenome (nulo em contas antigas), cpf (11 dígitos, único, nulo em contas antigas), email (citext, único), telefone, data_nascimento (date, nula em contas antigas; a idade é calculada, não guardada), senha_hash (argon2)
- cep, logradouro, numero, complemento, bairro, cidade, uf (nulos no banco: contas antigas e as criadas por script não têm)
- email_verificado_em (nulo = email não confirmado)
- foto_id (uuid, único, nulo): arquivos `{foto_id}.webp` e `{foto_id}_miniatura.webp` em `UPLOAD_DIR` (nulo em contas antigas e nas criadas por script)
- perfil: enum `ADMIN | COLABORADOR | PADRAO` (padrão `PADRAO`)
- status: enum `PENDENTE | ATIVO | INATIVO` (padrão `PENDENTE`)
- tentativas_falhas (int, padrão 0), bloqueado_ate (nulo)
- criado_em, atualizado_em

**tokens_redefinicao_senha**
- id, usuario_id → usuarios, token_hash (único), expira_em, usado_em (nulo), criado_em

**tokens_verificacao_email**
- id, usuario_id → usuarios, token_hash (único), expira_em, usado_em (nulo), criado_em

**tokens_troca_email**
- id, usuario_id → usuarios, solicitacao_id → solicitacoes_alteracao, token_hash (único), expira_em, usado_em (nulo), criado_em

**solicitacoes_alteracao**
- id, usuario_id → usuarios, tipo enum `EMAIL | CPF`, valor_novo (email em minúsculas ou CPF com 11 dígitos), status enum `AGUARDANDO_EMAIL | PENDENTE | APROVADA | RECUSADA | CANCELADA`, email_confirmado_em (nulo), decidido_por_id → usuarios (nulo), decidido_em (nulo), criado_em
- No máximo uma solicitação em aberto (`AGUARDANDO_EMAIL` ou `PENDENTE`) por conta e tipo (índice único parcial)

**pessoas**
- id, nome, sobrenome, apelido, idade_aproximada (smallint), email, telefone, nome_contato, telefone_contato, observacoes
- consentimento (bool), consentimento_em (nulo)
- foto_perfil_id → fotos (nulo)
- status: enum `ATIVA | INATIVA`; motivo_inativacao, inativada_em, inativada_por_id → usuarios
- cadastrada_por_id → usuarios
- ultima_vez_visto, ultima_latitude numeric(9,6), ultima_longitude numeric(9,6), ultimo_endereco — campos desnormalizados, atualizados pelo service a cada avistamento mais recente
- criado_em, atualizado_em
- Índice GIN trigram sobre `unaccent(nome || ' ' || sobrenome || ' ' || coalesce(apelido, ''))` (usar função imutável de apoio)

**fotos**
- id, pessoa_id → pessoas, tipo enum `PERFIL | ALBUM`, caminho, caminho_miniatura, mime, tamanho_bytes, legenda, enviada_por_id → usuarios, criado_em

**avistamentos**
- id, pessoa_id → pessoas, latitude numeric(9,6), longitude numeric(9,6), endereco (nulo), visto_em, observacao, registrado_por_id → usuarios, criado_em
- Índices: (pessoa_id, visto_em desc) e (visto_em)

**logs_auditoria**
- id (bigserial), usuario_id (nulo), acao, entidade, entidade_id, detalhes (jsonb, sem dados pessoais de PSDR), ip (inet), criado_em

## 8. API (prefixo `/api/v1`)

Formato de erro: `{"detail": "mensagem em pt-BR", "codigo": "CODIGO"}`, com campos extras quando fizer sentido (ex.: `segundos_restantes`).
Códigos: `CREDENCIAIS_INVALIDAS`, `CONTA_BLOQUEADA`, `CONTA_PENDENTE`, `CONTA_INATIVA`, `TOKEN_INVALIDO`, `EMAIL_NAO_VERIFICADO`, `SEM_PERMISSAO`, `NAO_ENCONTRADO`, `VALIDACAO`, `ULTIMO_ADMIN`, `SEM_CONSENTIMENTO`, `EMAIL_EM_USO`, `CPF_EM_USO`, `SOLICITACAO_ENCERRADA`, `MUITAS_REQUISICOES`.

**Autenticação**
- `POST /auth/login` (corpo: login — email ou CPF —, senha)
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/cadastro` (multipart: campos do cadastro + foto)
- `POST /auth/verificar-email` (corpo: token)
- `POST /auth/reenviar-verificacao` (corpo: email)
- `POST /auth/confirmar-novo-email` (corpo: token)
- `POST /auth/recuperar-senha` (corpo: login — email ou CPF)
- `GET /auth/redefinir-senha/validar?token=`
- `POST /auth/redefinir-senha`
- `GET /auth/me`

**Meu perfil**
- `PATCH /me`
- `PATCH /me/senha`
- `PUT /me/foto` (multipart: arquivo)
- `POST /me/pedido-alteracao` (email e/ou cpf, senha)
- `DELETE /me/troca-email`
- `DELETE /me/troca-cpf`

**Usuários (ADMIN)**
- `GET /usuarios?busca=&perfil=&status=&pagina=&tamanho=`
- `GET /usuarios/{id}` (todos os dados da conta; gera log de visualização)
- `PATCH /usuarios/{id}` (perfil, status)
- `PATCH /usuarios/{id}/dados` (sobrenome e/ou CPF de contas antigas, só se vazios)

**Solicitações (ADMIN)**
- `GET /solicitacoes?status=&tipo=&pagina=&tamanho=`
- `POST /solicitacoes/{id}/aprovar`
- `POST /solicitacoes/{id}/recusar`

**Pessoas**
- `GET /pessoas?busca=&status=&visto_desde=&ordem=&pagina=&tamanho=`
- `GET /pessoas/sugestoes?q=` (autocomplete e aviso de duplicidade)
- `POST /pessoas`
- `GET /pessoas/{id}` (gera log de visualização)
- `PUT /pessoas/{id}`
- `POST /pessoas/{id}/inativar` (corpo: motivo opcional)
- `POST /pessoas/{id}/reativar`
- `POST /pessoas/{id}/foto-perfil` (multipart)
- `POST /pessoas/{id}/fotos` (multipart, álbum)
- `DELETE /pessoas/{id}/fotos/{foto_id}`
- `GET /pessoas/{id}/avistamentos`

**Avistamentos e mapa**
- `POST /avistamentos`
- `GET /mapa/marcadores` (PSDR ativas com última localização)
- `GET /mapa/calor?pessoa_id=&de=&ate=` (lista de `[lat, lng, peso]`)
- `GET /geocodificacao/reversa?lat=&lng=`

**Outros**
- `GET /arquivos/{id}?exp=&assinatura=`
- `GET /arquivos/contas/{id}?exp=&assinatura=` (foto de conta; assinatura própria)
- `GET /auditoria?usuario_id=&acao=&de=&ate=&pagina=` (ADMIN)
- `GET /saude`

## 9. Variáveis de ambiente (`.env.example`)
```
DATABASE_URL=postgresql+psycopg://aurora:aurora@localhost:5432/aurora
JWT_SECRET=troque-isto
ACCESS_TOKEN_MINUTOS=30
REFRESH_TOKEN_DIAS=7
FRONTEND_URL=http://localhost:5173
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_REMETENTE=nao-responda@projetoaurora.local
UPLOAD_DIR=./uploads
ARQUIVOS_URL_SEGREDO=troque-isto-tambem
MAX_TENTATIVAS_LOGIN=5
MINUTOS_BLOQUEIO=5
HORAS_VALIDADE_TOKEN_EMAIL=24
MAX_REENVIOS_VERIFICACAO_POR_HORA=3
NOMINATIM_USER_AGENT=ProjetoAurora/1.0 (contato@exemplo.com)
ADMIN_EMAIL=admin@projetoaurora.local
ADMIN_SENHA=TroqueEstaSenha1
```

## 10. Fases de implementação

Cada fase termina com lint e testes passando, um resumo do que foi feito e um roteiro de teste manual.

- **Fase 0 — Estrutura**: monorepo; `docker-compose.yml` (postgres:16 + axllent/mailpit); `.env.example`; FastAPI com configuração, CORS e `/api/v1/saude`; Alembic configurado; React + Vite + TypeScript + Tailwind + React Router; tokens de design, fonte Montserrat, tamanho de fonte (A-/Aa/A+) e modo escuro funcionando; layout logado (barra de acessibilidade, header, footer) e layout de autenticação; páginas 404 e 403.
- **Fase 1 — Banco**: modelos e migrações de todas as tabelas e extensões; script `criar_admin`; script `seed_dev` com dados fictícios (Faker pt_BR: ~30 pessoas e ~300 avistamentos espalhados por Petrópolis, sem fotos reais).
- **Fase 2 — Autenticação**: login com bloqueio, cadastro com status pendente, recuperar e redefinir senha com email no Mailpit, refresh, logout, `/auth/me` e rotas protegidas no frontend. Telas: Login, Cadastro, Cadastro enviado, Recuperar senha (2 etapas) e Link expirado. Testes de bloqueio, token e status da conta.
- **Fase 3 — Home e usuários**: Home com cards por perfil, Meu perfil, Gerenciar usuários (aprovar, recusar, alterar perfil, inativar, regra do último admin) e gravação de auditoria. Testes de permissão por perfil.
- **Fase 4 — Pessoas**: cadastro em 3 etapas, aviso de duplicidade, edição, inativação e reativação, fotos (perfil e álbum, EXIF removido, URLs assinadas) e tela Perfil da pessoa.
- **Fase 5 — Buscar**: busca sem acento, filtros, paginação no servidor, ações por perfil e versão em cards no celular.
- **Fase 6 — Mapa**: marcadores com cluster, painel da pessoa, registrar avistamento por clique ou GPS, geocodificação reversa, atalho "Cadastrar nova pessoa" e visualização em lista.
- **Fase 7 — Mapa de calor**: tela geral com filtros + mapa de calor e histórico no perfil da pessoa.
- **Fase 8 — Acabamento**: VLibras e "ouvir página", revisão de acessibilidade e responsividade, PWA (manifest, ícones, service worker básico), tela de logs de auditoria, página de Privacidade, revisão dos testes e README.

## 11. Decisões tomadas
Estas decisões já foram aprovadas e valem sobre os protótipos:
- Contas novas entram como `PENDENTE` e só acessam o sistema depois de aprovadas por uma pessoa administradora, para proteger os dados das PSDR.
- Antes da aprovação, a pessoa confirma o email por link; o cadastro e o Meu perfil têm endereço obrigatório, preenchido pelo ViaCEP.
- Login e recuperação de senha aceitam email ou CPF. Toda conta tem foto (obrigatória no cadastro; contas antigas são avisadas, não bloqueadas).
- Toda troca de email ou CPF passa pela aprovação de ADMIN (tela Solicitações); a de email exige antes abrir o link enviado ao email novo. O email e o CPF atuais valem até a aprovação.
- Administração (Usuários, Solicitações, Permissões, Auditoria) fica no menu da conta, não na barra principal; mudar o perfil de quem já foi aprovado é feito em Permissões.
- Consentimento obrigatório para enviar fotos; metadados EXIF sempre removidos.
- Auditoria inclui a visualização do perfil de cada PSDR.
- `idade_aproximada` no lugar de data de nascimento.
- PSDR é inativada, nunca excluída.
- Mensagens de login e de recuperação de senha nunca revelam se um email ou CPF está cadastrado.
- "Perfil de acesso" no lugar de "Cargo" na interface.
- Verde mais escuro (`#1E7F6B`) para textos e botões, por contraste (WCAG AA); o verde do protótipo fica só para decoração.
- PWA no lugar de "Baixe o App".
- OpenStreetMap + Leaflet no lugar do Google Maps (sem custo e sem chave de API).

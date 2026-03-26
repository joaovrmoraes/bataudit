# BatAudit — Roadmap de Melhorias

> Documento de planejamento técnico. Cada fase pode ser executada de forma independente.

---

## Fase 1 — Remover GraphQL e criar Reader REST

**Objetivo:** Eliminar a complexidade desnecessária do gqlgen e substituir pelo padrão REST já usado no restante do projeto.

- [ ] Remover o diretório `graph/`
- [ ] Remover o arquivo `gqlgen.yml`
- [ ] Reescrever `cmd/api/reader/main.go` como servidor REST simples (Gin + rotas do `handler.go`)
- [ ] Remover dependências `gqlgen` e `gqlparser` do `go.mod` / `go.sum`
- [ ] Verificar que o frontend continua funcionando (já usa REST em `http://localhost:8080/audit`)

**Notas:**
- O `handler.go` já tem `List` e `Details` implementados e prontos para uso
- O Reader REST vai rodar na mesma porta atual (`8082`)

---

## Fase 2 — Filtros na listagem da API

**Objetivo:** Tornar o `GET /audit` útil para consultas reais, não só paginação.

- [ ] Adicionar filtros ao `repository.List()` via struct de filtros (GORM dynamic where)
- [ ] Adicionar leitura dos query params no `handler.List()`
- [ ] Filtros a implementar:
  - [ ] `service_name` — filtrar por serviço
  - [ ] `identifier` — filtrar por usuário/cliente
  - [ ] `method` — filtrar por método HTTP (GET, POST, etc.)
  - [ ] `status_code` — filtrar por código de resposta
  - [ ] `start_date` / `end_date` — filtrar por período (formato ISO 8601)
  - [ ] `environment` — filtrar por ambiente (prod, staging, dev)

---

## Fase 3 — Autenticação, Usuários e Multi-Projeto

**Objetivo:** Proteger o sistema com login no dashboard e token no SDK, com suporte a múltiplos projetos e controle de acesso por roles.

### 3.1 Modelo de dados

- [ ] Criar tabela `users` (id, name, email, password_hash, role, created_at)
- [ ] Criar tabela `projects` (id, name, slug, created_by, created_at)
- [ ] Criar tabela `project_members` (user_id, project_id, role) — vínculo entre usuário e projeto
- [ ] Criar tabela `api_keys` (id, key_hash, project_id, name, created_at, expires_at, active)
- [ ] Criar migrations para todas as tabelas acima

**Roles:**
| Role | Escopo | Permissões |
|---|---|---|
| `owner` | Global | Vê todos os projetos, gerencia tudo |
| `admin` | Por projeto | Gerencia usuários do projeto, vê dados |
| `viewer` | Por projeto | Só visualiza o dashboard, sem acesso a configurações |

### 3.2 Auto-criação de projeto via SDK

> Zero configuração no frontend para começar — o projeto aparece automaticamente na primeira requisição.

- [ ] No Writer, ao receber um evento com `service_name`, verificar se o projeto já existe
- [ ] Se não existir, criar automaticamente associado à `api_key` usada na requisição
- [ ] Se já existir, apenas associar o evento ao projeto
- [ ] O `service_name` do modelo `Audit` é o identificador do projeto

**Fluxo:**
```
SDK (api_key + service_name) → Writer → projeto criado automaticamente → evento associado
```

### 3.3 Autenticação do dashboard (login com JWT)

- [ ] Endpoint `POST /auth/login` — recebe email/senha, retorna JWT
- [ ] Endpoint `POST /auth/logout` — invalida o token
- [ ] Endpoint `GET /auth/me` — retorna dados do usuário logado
- [ ] Middleware JWT no Reader que valida o token em todas as rotas protegidas
- [ ] Tela de login no frontend (primeira tela antes do dashboard)
- [ ] Setup inicial: na primeira execução, criar usuário owner via env vars ou wizard no frontend

### 3.4 Autenticação do SDK (API Key no Writer)

- [ ] Middleware no Writer que valida o header `X-API-Key`
- [ ] Retornar `401` para chaves inválidas/expiradas/inativas
- [ ] Associar cada requisição ao projeto da API Key automaticamente

### 3.5 Gerenciamento de usuários e projetos no frontend

- [ ] Página de configurações do projeto (admin/owner)
  - [ ] Listar e convidar membros (por email)
  - [ ] Definir role de cada membro
  - [ ] Remover membros
- [ ] Página de API Keys
  - [ ] Listar keys ativas
  - [ ] Gerar nova key (exibe uma única vez)
  - [ ] Revogar key existente
- [ ] Seletor de projeto no header do dashboard
  - [ ] Owner vê opção "Todos os projetos" (visão consolidada)
  - [ ] Demais roles veem apenas os projetos aos quais têm acesso

### 3.6 Visão consolidada do Owner

- [ ] Owner pode selecionar "Todos os projetos" no seletor
- [ ] Dashboard exibe métricas agregadas de todos os projetos
- [ ] Event feed mostra eventos de todos os projetos com coluna `project` visível
- [ ] Filtro por projeto disponível na visão consolidada

### 3.7 Rate Limiting

- [ ] Adicionar middleware de rate limiting por API Key (ex: `ulule/limiter` com store Redis)
- [ ] Configurar limite padrão (ex: 1000 req/hora por key)
- [ ] Retornar `429 Too Many Requests` ao exceder

### 3.8 Separação de responsabilidades

- [ ] Writer (`8081`) fica interno — autenticado apenas por API Key
- [ ] Reader (`8082`) fica exposto — autenticado por JWT
- [ ] Revisar Docker Compose para refletir essa separação

---

## Fase 4 — Documentação da API

**Objetivo:** Facilitar a integração por parte de desenvolvedores externos.

- [ ] Adicionar Swagger/OpenAPI ao Reader usando `swaggo/swag`
- [ ] Documentar todos os endpoints com exemplos de request/response
- [ ] Documentar os filtros disponíveis
- [ ] Documentar os códigos de erro (BAT-001, BAT-002, BAT-003)
- [ ] Expor o Swagger UI em `/docs`

---

## Fase 5 — Tempo de Sessão

**Objetivo:** Permitir análise do tempo que usuários passam utilizando os sistemas monitorados.

**Contexto:** O modelo atual registra requisições individuais. Sessão precisa ser derivada ou explicitamente rastreada.

### 5.1 Opção A — Derivar das auditorias existentes (sem mudar o modelo)
> Recomendada como ponto de partida. Não quebra o contrato da API.

- [ ] Criar endpoint `GET /audit/sessions` que agrupa eventos por `identifier` + janela de inatividade (ex: 30min sem atividade = sessão encerrada)
- [ ] Retornar `session_start`, `session_end`, `duration_seconds`, `event_count` por sessão
- [ ] Adicionar filtros: `identifier`, `service_name`, `start_date` / `end_date`

### 5.2 Opção B — Rastreamento explícito via `session_id` (mudança de modelo)
> Para quem precisar de maior precisão. Opt-in — quem não passar `session_id` continua funcionando.

- [ ] Adicionar campo `session_id` opcional ao modelo `Audit`
- [ ] Criar migration para adicionar a coluna `session_id`
- [ ] Criar endpoint `GET /audit/sessions/:session_id` — detalhes de uma sessão específica
- [ ] Calcular duração via `max(timestamp) - min(timestamp)` agrupado por `session_id`

---

## Fase 6 — Dashboard Frontend

**Objetivo:** Frontend próprio embutido que funcione out of the box — sem depender de Grafana ou Metabase. A simplicidade é o diferencial do projeto frente ao Datadog/Sentry.

**Contexto:** O frontend atual é apenas uma lista paginada de eventos. Para se posicionar como alternativa self-hosted ao Datadog/Sentry para projetos menores, o dashboard precisa mostrar valor imediato ao ser instalado.

### 6.1 Métricas e gráficos principais
- [ ] Gráfico de volume de eventos por período (linha do tempo)
- [ ] Taxa de erros em tempo real (status 4xx e 5xx)
- [ ] Tempo de resposta médio por serviço
- [ ] Top serviços mais ativos
- [ ] Contadores de resumo no topo: total de eventos, erros, p95 de response time

### 6.2 Filtros no Event Feed
- [ ] Implementar o botão "Filter" já existente no frontend
- [ ] Filtrar por `service_name`, `method`, `status_code`, `environment`, `identifier`
- [ ] Filtrar por período (`start_date` / `end_date`) com date picker
- [ ] Persistir filtros na URL (query params) para compartilhamento

### 6.3 Detalhe de evento
- [ ] Página/modal de detalhe ao clicar em um evento
- [ ] Exibir todos os campos: `request_body`, `query_params`, `user_roles`, `ip`, `user_agent`, etc.

### 6.4 Visualização de sessões
- [ ] Página de sessões por usuário (`identifier`)
- [ ] Timeline de ações dentro de uma sessão
- [ ] Duração total da sessão

---

## Fase 7 — SDK Node.js (Backend)

**Objetivo:** Primeiro SDK oficial do BatAudit, voltado para aplicações Node.js. Prioridade por ser a stack mais comum entre o público-alvo.

**Contexto:** O SDK fica no backend da aplicação real — não no frontend. Atua como middleware transparente que intercepta todas as requisições HTTP e envia os eventos para o BatAudit Writer.

### 7.1 Funcionalidades core

- [ ] Publicar pacote `@bataudit/node` no npm
- [ ] Configuração mínima: `apiKey` + `serviceName` + `writerUrl`
- [ ] Middleware para **Express** — `app.use(bataudit.middleware())`
- [ ] Middleware para **Fastify** — `app.addHook('onResponse', ...)`
- [ ] Captura automática: `method`, `path`, `status_code`, `response_time`, `ip`, `user_agent`
- [ ] Passagem opcional de dados do usuário: `identifier`, `user_email`, `user_name`, `user_roles`
- [ ] Envio assíncrono e não-bloqueante (não impacta latência da aplicação)
- [ ] Retry automático em caso de falha no envio

### 7.2 Modo serverless (Lambda / funções efêmeras)

> Em Lambda, o processo pode ser hard-killed antes do middleware enviar o evento. O modo `wrap` garante o flush antes do encerramento.

- [ ] Método `bataudit.wrap(handler)` para Lambda — garante envio via `try/finally`
- [ ] Flush forçado antes do processo encerrar
- [ ] Documentar limitação: hard-kill por OOM ou timeout da plataforma não pode ser capturado pelo backend

```js
// Lambda
export const handler = (event) => {
  return bataudit.wrap(async () => {
    // sua lógica aqui
  })
}
```

### 7.3 Geração do request_id

- [ ] SDK gera automaticamente um `request_id` único por requisição (formato `bat-xxxx`)
- [ ] Se o header `X-Request-ID` já vier na requisição, usa o valor existente
- [ ] Injeta o `request_id` no header de resposta para o cliente poder correlacionar

---

## Fase 8 — SDK Browser (Frontend)

**Objetivo:** SDK opcional para capturar eventos do lado do cliente — especialmente útil para detectar crashes de backend não auditados (Lambda timeout, OOM, etc.).

**Contexto:** Complementa o SDK backend via correlação por `request_id`. Não substitui o backend — é uma camada adicional de cobertura.

### 8.1 Funcionalidades core

- [ ] Publicar pacote `@bataudit/browser` no npm
- [ ] Interceptar `fetch` e `XMLHttpRequest` automaticamente
- [ ] Gerar `request_id` antes de cada requisição e injetar no header `X-Request-ID`
- [ ] Capturar: `method`, `url`, `status_code`, `response_time`, `request_id`
- [ ] Enviar evento ao BatAudit com `source: "browser"`
- [ ] Configuração mínima: `apiKey` + `serviceName` + `writerUrl`

### 8.2 Correlação frontend-backend

> Permite detectar requisições que o backend não conseguiu auditar — crashes totais, Lambda timeout, OOM.

- [ ] Adicionar campo `source` ao modelo `Audit` (`backend` | `browser`)
- [ ] Criar migration para a coluna `source`
- [ ] No BatAudit, cruzar eventos por `request_id`: se existe evento browser mas **não existe** evento backend → sinalizar como **requisição órfã**
- [ ] Endpoint `GET /audit/orphans` — lista eventos sem correspondência backend
- [ ] Exibir no dashboard com destaque: "X requisições sem resposta do backend nos últimos 24h"

```
Browser gera request_id → envia requisição com X-Request-ID
      ├── Backend responde → SDK backend audita com mesmo request_id → par completo
      └── Backend crasha/timeout → SDK browser audita sozinho → requisição órfã detectada
```

---

## Fase 9 — Testes e Validação

**Objetivo:** Garantir confiabilidade do sistema em camadas — da lógica isolada até o fluxo real com dados precisos.

### 9.1 Testes unitários (junto com o desenvolvimento)

- [ ] Testes para `service.go` — validações, regras de negócio, cálculo de sessão
- [ ] Testes para `sanitizer.go` e `validator.go` — detecção e mascaramento de dados sensíveis
- [ ] Testes para lógica de correlação de `request_id` (orphans)
- [ ] Testes para o SDK Node.js — geração de `request_id`, captura de campos, modo Lambda

### 9.2 Testes de integração

> Sobe banco + Redis reais via Docker Compose de teste. Garante que o fluxo completo funciona sem depender de aplicação real.

- [ ] Criar `docker-compose.test.yml` com PostgreSQL e Redis isolados para testes
- [ ] Teste do fluxo completo: `Writer → Redis → Worker → banco → Reader`
- [ ] Teste de falha no Redis — Writer deve retornar erro adequado
- [ ] Teste de autenticação — JWT inválido, API Key expirada, sem permissão
- [ ] Teste de rate limiting — verificar que o 429 é retornado corretamente

### 9.3 Aplicação mock (a mais importante para validar dados reais)

> Uma aplicação Node.js simples com o SDK instalado que simula cenários reais. Gera eventos reais no BatAudit — você vê no dashboard exatamente o que um usuário real veria.

- [ ] Criar repositório/diretório `mock-app/` com Express + SDK BatAudit instalado
- [ ] Estrutura de cenários:

```
mock-app/
  ├── server.js
  └── scenarios/
      ├── normal.js     → requisições bem-sucedidas (200s, GET/POST/PUT/DELETE)
      ├── errors.js     → 400s, 422s, 500s, erros de validação
      ├── lambda.js     → simula crash e timeout antes de responder
      ├── users.js      → múltiplos usuários com diferentes roles e identifiers
      └── load.js       → volume alto para testar fila, worker e autoscaling
```

- [ ] Cada cenário executável isoladamente: `node scenarios/errors.js`
- [ ] Cenário `lambda.js` usa o modo `bataudit.wrap()` e simula crash via `process.exit(1)` no meio do handler
- [ ] Cenário `load.js` configurável: número de requisições, concorrência, intervalo

### 9.4 Seed de dados para desenvolvimento do frontend

> Popula o banco com dados variados para conseguir visualizar todos os gráficos, filtros e métricas do dashboard sem precisar gerar eventos manualmente.

- [ ] Criar script `scripts/seed.go` ou `scripts/seed.sh`
- [ ] Gerar dados para múltiplos projetos e serviços
- [ ] Cobrir variações de: `method`, `status_code`, `environment`, `response_time`, `user_roles`
- [ ] Distribuição temporal realista — eventos espalhados nos últimos 30 dias
- [ ] Incluir cenários de pico (muitos erros em um período) para testar alertas visuais
- [ ] Incluir eventos órfãos (browser sem backend) para testar a detecção de orphans

---

## Fase 10 — Redesign do Frontend

**Objetivo:** Reformular completamente o visual do dashboard para um estilo moderno, com suporte a dark e light mode, usando shadcn/ui como base.

**Contexto:** O estilo de referência foi identificado em 3 arquivos da comunidade Figma (links abaixo). Os detalhes do estilo ainda precisam ser extraídos — screenshots ou tokens de design precisam ser compartilhados para iniciar a implementação.

**Referências Figma:**
- https://www.figma.com/community/file/1554529095872857492
- https://www.figma.com/community/file/1564725760418771079
- https://www.figma.com/community/file/1580994817007013257

> **Pendente:** compartilhar screenshots ou descrever o que agrada em cada referência antes de iniciar esta fase.

### 10.1 Design tokens

- [ ] Definir paleta de cores para dark e light mode baseada nas referências
- [ ] Atualizar variáveis CSS em `index.css` com os novos tokens
- [ ] Atualizar `tailwind.config` com as cores, tipografia e espaçamentos do novo estilo

### 10.2 Componentes base (shadcn/ui)

- [ ] Revisar e customizar os componentes shadcn já existentes para o novo estilo
- [ ] Garantir que todos os componentes funcionam corretamente em dark e light mode
- [ ] Implementar toggle de dark/light mode no header com persistência (localStorage)

### 10.3 Layout e navegação

- [ ] Redesenhar o layout geral — sidebar, header, área de conteúdo
- [ ] Redesenhar o header com seletor de projeto e menu de usuário
- [ ] Redesenhar a sidebar com navegação entre seções (dashboard, eventos, sessões, configurações)

### 10.4 Páginas

- [ ] Redesenhar o dashboard principal (métricas, gráficos, event feed)
- [ ] Redesenhar a página de login e setup inicial
- [ ] Redesenhar a página de configurações (usuários, API Keys, projetos)
- [ ] Redesenhar a página de sessões

---

## Pré-requisitos antes de escalar — fazer cedo

> Problemas pequenos que vão travar o crescimento se não forem resolvidos antes das fases maiores.

### Backend — substituir fmt por logger estruturado

Hoje o projeto usa `fmt.Printf` / `fmt.Println` em todo lugar. Em produção isso é inútil — sem nível de log, sem contexto, sem como filtrar. Trocar por `slog` (padrão da stdlib Go desde 1.21) antes de adicionar mais código.

- [ ] Substituir todos os `fmt.Printf` / `fmt.Println` em `cmd/api/writer/main.go` por `slog`
- [ ] Substituir todos em `cmd/api/reader/main.go`
- [ ] Substituir todos em `cmd/api/worker/main.go`
- [ ] Substituir todos em `internal/worker/service.go`
- [ ] Substituir todos em `internal/worker/autoscale.go`
- [ ] Substituir todos em `internal/worker/helpers.go`
- [ ] Substituir todos em `internal/db/db.go`
- [ ] Configurar nível de log via variável de ambiente (`LOG_LEVEL=debug|info|warn|error`)

### Backend — tratar panics no db.go

O `db.go` usa `panic` em 5 pontos diferentes (falha de config, migration, conexão). Em um servidor isso derruba o processo inteiro. Substituir por retorno de erro tratado no `main.go`.

- [ ] Transformar `Init()` para retornar `(*gorm.DB, error)` em vez de usar `panic`
- [ ] Tratar o erro no `main.go` de cada serviço com log + `os.Exit(1)` limpo
- [ ] Idem para `RunMigrations()` — já retorna erro mas o caller faz `panic` em vez de tratar

### Versionamento da API

Prefixar todas as rotas com `/v1/` desde o início. Barato de fazer agora, caro de mudar depois quando o SDK já estiver em uso.

- [ ] Adicionar prefixo `/v1` em todas as rotas do Writer (`/v1/audit`)
- [ ] Adicionar prefixo `/v1` em todas as rotas do Reader (`/v1/audit`, `/v1/auth`, etc.)
- [ ] Atualizar o frontend para usar as rotas versionadas
- [ ] Documentar no README que a API é versionada

### Frontend — URL hardcoded e erros silenciosos

- [ ] Remover `http://localhost:8080` hardcoded de `frontend/src/http/audit/list.tsx`
- [ ] Criar variável de ambiente `VITE_API_URL` e usar em todas as chamadas HTTP
- [ ] Adicionar tratamento de erro nas chamadas `useQuery` — exibir mensagem ao usuário em vez de tela em branco quando a API falhar

---

## Fase 11 — Melhorias gerais (backlog)

- [ ] Adicionar endpoint `GET /audit/stats` — resumo agregado (total por serviço, por método, erros, etc.)
- [ ] Suporte a ordenação na listagem (`sort_by`, `sort_order`)
- [ ] Internacionalizar mensagens de erro (hoje misturadas em PT e EN)

---

## Ordem sugerida de execução

```
Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5.1 → Fase 6 → Fase 5.2 → Fase 7 → Fase 8 → Fase 9 → Fase 10 → Fase 11
```

- Fase 1 e 2 são pré-requisitos para tudo
- Fase 3.1 (modelo de dados) é pré-requisito para 3.2, 3.3, 3.4, 3.5 e 3.6
- Fase 3.2 (auto-criação de projeto) depende da 3.4 (API Key no Writer) estar pronta
- Fase 4 (documentação) pode ser feita em paralelo com a 3
- Fase 5.1 depende da Fase 2 (filtros) estar pronta
- Fase 6 depende da Fase 3 (autenticação + projetos) estar pronta
- Fase 6.4 (sessões no frontend) depende da Fase 5 estar pronta
- Fase 8 (SDK browser) depende da Fase 7 (SDK backend) estar pronta
- Fase 9.1 (testes unitários) deve ser feita junto com cada fase, não depois
- Fase 9.3 (mock app) depende da Fase 7 (SDK Node.js) estar pronta
- Fase 9.4 (seed) depende da Fase 3 (multi-projeto) estar pronta
- Fase 10 (redesign) depende da Fase 6 (dashboard funcional) estar pronta — redesenhar em cima de algo que já funciona

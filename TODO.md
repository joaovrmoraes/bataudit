# BatAudit — Roadmap de Melhorias

> Documento de planejamento técnico. Cada fase pode ser executada de forma independente.

---

## Fase 1 — Remover GraphQL e criar Reader REST

**Objetivo:** Eliminar a complexidade desnecessária do gqlgen e substituir pelo padrão REST já usado no restante do projeto.

- [x] Remover o diretório `graph/`
- [x] Remover o arquivo `gqlgen.yml`
- [x] Reescrever `cmd/api/reader/main.go` como servidor REST simples (Gin + rotas do `handler.go`)
- [x] Remover dependências `gqlgen` e `gqlparser` do `go.mod` / `go.sum`
- [x] Verificar que o frontend continua funcionando (já usa REST em `http://localhost:8080/audit`)

**Notas:**
- O `handler.go` já tem `List` e `Details` implementados e prontos para uso
- O Reader REST vai rodar na mesma porta atual (`8082`)

---

## Fase 2 — Filtros na listagem da API

**Objetivo:** Tornar o `GET /audit` útil para consultas reais, não só paginação.

- [x] Adicionar filtros ao `repository.List()` via struct de filtros (GORM dynamic where)
- [x] Adicionar leitura dos query params no `handler.List()`
- [x] Filtros a implementar:
  - [x] `service_name` — filtrar por serviço
  - [x] `identifier` — filtrar por usuário/cliente
  - [x] `method` — filtrar por método HTTP (GET, POST, etc.)
  - [x] `status_code` — filtrar por código de resposta
  - [x] `start_date` / `end_date` — filtrar por período (formato ISO 8601)
  - [x] `environment` — filtrar por ambiente (prod, staging, dev)

---

## Fase 3 — Autenticação, Usuários e Multi-Projeto

**Objetivo:** Proteger o sistema com login no dashboard e token no SDK, com suporte a múltiplos projetos e controle de acesso por roles.

### 3.1 Modelo de dados

- [x] Criar tabela `users` (id, name, email, password_hash, role, created_at)
- [x] Criar tabela `projects` (id, name, slug, created_by, created_at)
- [x] Criar tabela `project_members` (user_id, project_id, role) — vínculo entre usuário e projeto
- [x] Criar tabela `api_keys` (id, key_hash, project_id, name, created_at, expires_at, active)
- [x] Criar migrations para todas as tabelas acima

**Roles:**
| Role | Escopo | Permissões |
|---|---|---|
| `owner` | Global | Vê todos os projetos, gerencia tudo |
| `admin` | Por projeto | Gerencia usuários do projeto, vê dados |
| `viewer` | Por projeto | Só visualiza o dashboard, sem acesso a configurações |

### 3.2 Auto-criação de projeto via SDK

> Zero configuração no frontend para começar — o projeto aparece automaticamente na primeira requisição.

- [x] No Writer, ao receber um evento com `service_name`, verificar se o projeto já existe
- [x] Se não existir, criar automaticamente associado à `api_key` usada na requisição
- [x] Se já existir, apenas associar o evento ao projeto
- [x] O `service_name` do modelo `Audit` é o identificador do projeto

**Fluxo:**
```
SDK (api_key + service_name) → Writer → projeto criado automaticamente → evento associado
```

### 3.3 Autenticação do dashboard (login com JWT)

- [x] Endpoint `POST /auth/login` — recebe email/senha, retorna JWT
- [x] Endpoint `POST /auth/logout` — invalida o token
- [x] Endpoint `GET /auth/me` — retorna dados do usuário logado
- [x] Middleware JWT no Reader que valida o token em todas as rotas protegidas
- [x] Tela de login no frontend (primeira tela antes do dashboard)
- [x] Setup inicial: na primeira execução, criar usuário owner via env vars ou wizard no frontend

### 3.4 Autenticação do SDK (API Key no Writer)

- [x] Middleware no Writer que valida o header `X-API-Key`
- [x] Retornar `401` para chaves inválidas/expiradas/inativas
- [x] Associar cada requisição ao projeto da API Key automaticamente

### 3.5 Gerenciamento de usuários e projetos no frontend

- [x] Página de configurações do projeto (admin/owner)
  - [x] Listar e convidar membros (por email)
  - [x] Definir role de cada membro
  - [x] Remover membros
- [x] Página de API Keys
  - [x] Listar keys ativas
  - [x] Gerar nova key (exibe uma única vez)
  - [x] Revogar key existente
- [x] Seletor de projeto no header do dashboard
  - [x] Owner vê opção "Todos os projetos" (visão consolidada)
  - [x] Demais roles veem apenas os projetos aos quais têm acesso

### 3.6 Visão consolidada do Owner

- [x] Owner pode selecionar "Todos os projetos" no seletor
- [x] Dashboard exibe métricas agregadas de todos os projetos
- [x] Event feed mostra eventos de todos os projetos com coluna `project` visível
- [x] Filtro por projeto disponível na visão consolidada

### 3.7 Rate Limiting *(somente se virar multi-tenant público)*

> **Contexto:** Em um setup self-hosted onde você controla quem recebe API Key, rate limiting não agrega valor — o Redis + Worker autoscaling já absorvem picos naturalmente. Só faz sentido se o BatAudit for oferecido como SaaS com clientes externos não confiáveis.

- [ ] Adicionar middleware de rate limiting por API Key (`ulule/limiter` com store Redis)
- [ ] Configurar limite padrão configurável por projeto (ex: 1000 req/hora)
- [ ] Retornar `429 Too Many Requests` com header `Retry-After`
- [ ] Permitir override do limite por projeto (planos diferentes)

### 3.8 Separação de responsabilidades

- [x] Writer (`8081`) fica interno — autenticado apenas por API Key
- [x] Reader (`8082`) fica exposto — autenticado por JWT
- [x] Revisar Docker Compose para refletir essa separação (reader adicionado ao docker-compose.services.yml)

---

## Fase 4 — Documentação da API

**Objetivo:** Facilitar a integração por parte de desenvolvedores externos.

- [x] Adicionar Swagger/OpenAPI ao Reader usando `swaggo/swag`
- [x] Documentar todos os endpoints com exemplos de request/response
- [x] Documentar os filtros disponíveis
- [x] Documentar os códigos de erro (BAT-001, BAT-002, BAT-003)
- [x] Expor o Swagger UI em `/docs`

---

## Fase 5 — Tempo de Sessão

**Objetivo:** Permitir análise do tempo que usuários passam utilizando os sistemas monitorados.

**Contexto:** O modelo atual registra requisições individuais. Sessão precisa ser derivada ou explicitamente rastreada.

### 5.1 Opção A — Derivar das auditorias existentes (sem mudar o modelo)
> Recomendada como ponto de partida. Não quebra o contrato da API.

- [x] Criar endpoint `GET /audit/sessions` que agrupa eventos por `identifier` + janela de inatividade (ex: 30min sem atividade = sessão encerrada)
- [x] Retornar `session_start`, `session_end`, `duration_seconds`, `event_count` por sessão
- [x] Adicionar filtros: `identifier`, `service_name`, `start_date` / `end_date`

### 5.2 Opção B — Rastreamento explícito via `session_id` (mudança de modelo)
> Para quem precisar de maior precisão. Opt-in — quem não passar `session_id` continua funcionando.

- [x] Adicionar campo `session_id` opcional ao modelo `Audit`
- [x] Criar migration para adicionar a coluna `session_id` (migration 000008)
- [x] Criar endpoint `GET /audit/sessions/:session_id` — detalhes de uma sessão específica
- [x] Calcular duração via `max(timestamp) - min(timestamp)` agrupado por `session_id`

---

## Fase 6 — Dashboard Frontend

**Objetivo:** Frontend próprio embutido que funcione out of the box — sem depender de Grafana ou Metabase. A simplicidade é o diferencial do projeto frente ao Datadog/Sentry.

**Contexto:** O frontend atual é apenas uma lista paginada de eventos. Para se posicionar como alternativa self-hosted ao Datadog/Sentry para projetos menores, o dashboard precisa mostrar valor imediato ao ser instalado.

**Referência de layout:** O dashboard do retina-discord-scrapper é a referência visual. Estrutura: header fixo com título + timestamp do último evento + botão de refresh → linha de cards coloridos → tabela full-width de breakdown → split 50/50 com gráficos à esquerda e event feed à direita.

### 6.1 Header do dashboard

- [x] Título do projeto (nome do `service_name` selecionado ou "Todos os projetos")
- [x] Timestamp do último evento recebido: `Último evento: DD/MM/AA HH:MM`
- [x] Botão "Atualizar" — recarrega os dados manualmente
- [x] Auto-refresh a cada 60 segundos (sem reload de página)

### 6.2 Cards de métricas (linha superior)

> Inspiração direta nos cards do retina: background escuro, valor em fonte grande, cor semântica por tipo.

- [x] **Total de eventos** (cor: roxo `#818cf8`)
- [x] **Erros 4xx** — contagem + percentual do total (cor: laranja `#fb923c`)
- [x] **Erros 5xx** — contagem + percentual do total (cor: vermelho `#f87171`)
- [x] **Tempo médio de resposta** em ms (cor: azul `#60a5fa`)
- [x] **p95 de response time** (cor: teal `#2dd4bf`)
- [x] **Serviços ativos** — quantidade de `service_name` distintos (cor: verde `#34d399`)

### 6.3 Tabela de breakdown por serviço (full-width, abaixo dos cards)

> Equivalente à tabela "Por funcionalidade (tag)" do retina — mostra distribuição por dimensão principal.

- [x] Colunas: `Serviço`, `Requisições`, `Erros (4xx+5xx)`, `Taxa de erro`, `Tempo médio`, `Último evento`
- [x] Ordenável por qualquer coluna
- [x] Linha com destaque ao hover (`background: #232640`)
- [x] Badge colorido na coluna "Taxa de erro": verde se < 1%, laranja se < 5%, vermelho se ≥ 5%

### 6.4 Layout split — gráficos à esquerda, event feed à direita

> `grid-template-columns: 1fr 1fr` — colapsa para coluna única em telas < 900px.

**Coluna esquerda — gráficos (empilhados verticalmente):**
- [x] **Gráfico de área/linha** — volume de eventos por hora nas últimas 24h (Recharts shadcn)
- [x] **Gráfico de barras empilhadas** — breakdown por `status_code` (2xx / 3xx / 4xx / 5xx) por período
- [x] **Gráfico de donut** — distribuição de métodos HTTP (GET / POST / PUT / DELETE / PATCH)

**Coluna direita — event feed:**
- [x] Tabela dos últimos 50 eventos em ordem cronológica reversa
- [x] Colunas: `Hora`, `Serviço`, `Método`, `Path`, `Status`, `Tempo`
- [x] Badge de status com cor semântica: verde (2xx), azul (3xx), laranja (4xx), vermelho (5xx)
- [x] Badge de método: cor neutra distinta por verbo HTTP
- [x] Ao clicar na linha, abre modal/drawer com detalhe completo do evento

### 6.5 Filtros no Event Feed

- [x] Implementar o botão "Filter" já existente no frontend
- [x] Filtrar por `service_name`, `method`, `status_code`, `environment`, `identifier`
- [x] Filtrar por período (`start_date` / `end_date`) com date picker
- [x] Persistir filtros na URL (query params) para compartilhamento

### 6.6 Modal de detalhe de evento

- [x] Abre ao clicar em qualquer linha do event feed
- [x] Exibir todos os campos: `request_body`, `query_params`, `user_roles`, `ip`, `user_agent`, etc.
- [x] Fechar com `Esc` ou clique fora do modal

### 6.7 Visualização de sessões

- [x] Página de sessões por usuário (`identifier`)
- [x] Timeline de ações dentro de uma sessão
- [x] Duração total da sessão

---

## Fase 7 — SDK Node.js (Backend)

**Objetivo:** Primeiro SDK oficial do BatAudit, voltado para aplicações Node.js. Prioridade por ser a stack mais comum entre o público-alvo.

**Contexto:** O SDK fica no backend da aplicação real — não no frontend. Atua como middleware transparente que intercepta todas as requisições HTTP e envia os eventos para o BatAudit Writer.

### 7.1 Funcionalidades core

- [x] Publicar pacote `@bataudit/node` no npm
- [x] Configuração mínima: `apiKey` + `serviceName` + `writerUrl`
- [x] Middleware para **Express** — `app.use(createExpressMiddleware(config))`
- [x] Plugin para **Fastify** — `applyBatAuditPlugin(app, config)`
- [x] Captura automática: `method`, `path`, `status_code`, `response_time`, `ip`, `user_agent`
- [x] Passagem opcional de dados do usuário: `identifier`, `user_email`, `user_name`, `user_roles`
- [x] Envio assíncrono e não-bloqueante (não impacta latência da aplicação)
- [x] Retry automático em caso de falha no envio

### 7.2 Modo serverless (Lambda / funções efêmeras)

> Em Lambda, o processo pode ser hard-killed antes do middleware enviar o evento. O modo `wrap` garante o flush antes do encerramento.

- [x] Método `createLambdaWrapper(config)` — retorna `wrap(handler, getAuditData?)` com flush via `try/finally`
- [x] Flush forçado antes do processo encerrar
- [x] Documentar limitação: hard-kill por OOM ou timeout da plataforma não pode ser capturado pelo backend (sdks/node/README.md)

```ts
// Lambda
const wrap = createLambdaWrapper({ apiKey: '...', serviceName: 'my-fn', writerUrl: '...' })

export const handler = wrap(
  async (event) => { /* sua lógica */ },
  (event, result, error) => ({ identifier: event.userId, path: '/my-fn' })
)
```

### 7.3 Geração do request_id

- [x] SDK gera automaticamente um `request_id` único por requisição (formato `bat-<uuid>`)
- [x] Se o header `X-Request-ID` já vier na requisição, usa o valor existente
- [x] Injeta o `request_id` no header de resposta para o cliente poder correlacionar

---

## Fase 8 — SDK Browser (Frontend)

**Objetivo:** SDK opcional para capturar eventos do lado do cliente — especialmente útil para detectar crashes de backend não auditados (Lambda timeout, OOM, etc.).

**Contexto:** Complementa o SDK backend via correlação por `request_id`. Não substitui o backend — é uma camada adicional de cobertura.

### 8.1 Funcionalidades core

- [x] Publicar pacote `@bataudit/browser` no npm
- [x] Interceptar `fetch` e `XMLHttpRequest` automaticamente
- [x] Gerar `request_id` antes de cada requisição e injetar no header `X-Request-ID`
- [x] Capturar: `method`, `url`, `status_code`, `response_time`, `request_id`
- [x] Enviar evento ao BatAudit com `source: "browser"`
- [x] Configuração mínima: `apiKey` + `serviceName` + `writerUrl`
- [x] `setUser()` / `clearUser()` para contexto de usuário persistente entre requisições
- [x] `unpatch()` para restaurar fetch e XHR originais

### 8.2 Correlação frontend-backend

> Permite detectar requisições que o backend não conseguiu auditar — crashes totais, Lambda timeout, OOM.

- [x] Adicionar campo `source` ao modelo `Audit` (`backend` | `browser`)
- [x] Migration `000004_add_source_to_audits` para coluna `source`
- [x] Writer define `source = "backend"` automaticamente se não vier no payload
- [x] Endpoint `GET /v1/audit/orphans` — lista eventos browser sem correspondência backend
- [x] Exibir no dashboard com destaque: "X requisições sem resposta do backend nos últimos 24h" (card + banner no index.tsx)

```
Browser gera request_id → envia requisição com X-Request-ID
      ├── Backend responde → SDK backend audita com mesmo request_id → par completo
      └── Backend crasha/timeout → SDK browser audita sozinho → requisição órfã detectada
```

---

## Fase 9 — Testes e Validação

**Objetivo:** Garantir confiabilidade do sistema em camadas — da lógica isolada até o fluxo real com dados precisos.

### 9.1 Testes unitários (junto com o desenvolvimento)

- [x] Testes para `service.go` — validações, regras de negócio, cálculo de sessão
- [x] Testes para `sanitizer.go` e `validator.go` — detecção e mascaramento de dados sensíveis
- [ ] Testes para lógica de correlação de `request_id` (orphans)
- [x] Testes para o SDK Node.js — geração de `request_id`, captura de campos, modo Lambda (sdks/node/tests/)

### 9.2 Testes de integração

> Sobe banco + Redis reais via Docker Compose de teste. Garante que o fluxo completo funciona sem depender de aplicação real.

- [x] Criar `docker-compose.test.yml` com PostgreSQL e Redis isolados para testes
- [x] Teste do fluxo completo: `Writer → Redis → Worker → banco → Reader` (internal/audit/integration_test.go, roda em CI)
- [ ] Teste de falha no Redis — Writer deve retornar erro adequado
- [x] Teste de autenticação — JWT inválido, API Key expirada, sem permissão (internal/auth/integration_test.go)
- [ ] Teste de rate limiting — verificar que o 429 é retornado corretamente (rate limiting não implementado — ver Fase 3.7)

### 9.3 Aplicação mock (a mais importante para validar dados reais)

> Uma aplicação Node.js simples com o SDK instalado que simula cenários reais. Gera eventos reais no BatAudit — você vê no dashboard exatamente o que um usuário real veria.

- [x] Criar repositório/diretório `mock-app/` com Express + SDK BatAudit instalado
- [x] Estrutura de cenários:

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

- [x] Cada cenário executável isoladamente: `node scenarios/errors.js`
- [x] Cenário `lambda.js` usa o modo `bataudit.wrap()` e simula crash via `process.exit(1)` no meio do handler
- [x] Cenário `load.js` configurável: número de requisições, concorrência, intervalo

### 9.4 Seed de dados para desenvolvimento do frontend

> Popula o banco com dados variados para conseguir visualizar todos os gráficos, filtros e métricas do dashboard sem precisar gerar eventos manualmente.

- [x] Criar script `scripts/seed.go` ou `scripts/seed.sh`
- [x] Gerar dados para múltiplos projetos e serviços
- [x] Cobrir variações de: `method`, `status_code`, `environment`, `response_time`, `user_roles`
- [x] Distribuição temporal realista — eventos espalhados nos últimos 30 dias
- [x] Incluir cenários de pico (muitos erros em um período) para testar alertas visuais
- [x] Incluir eventos órfãos (browser sem backend) para testar a detecção de orphans (cmd/tools/seed/main.go)

---

## Fase 10 — Redesign do Frontend

**Objetivo:** Reformular completamente o visual do dashboard para um estilo moderno, com suporte a dark e light mode, usando shadcn/ui como base.

**Contexto:** O estilo de referência visual foi identificado no dashboard do retina-discord-scrapper (paleta dark `#0f1117` / `#1e2130` / `#2d3350`) e em 3 arquivos da comunidade Figma (links abaixo). Os tokens de cor já estão mapeados na Fase 6 — esta fase é sobre aplicar o redesign completo em cima do dashboard funcional.

**Referências Figma:**
- https://www.figma.com/community/file/1554529095872857492
- https://www.figma.com/community/file/1564725760418771079
- https://www.figma.com/community/file/1580994817007013257

**Paleta de referência (retina):**
```
Background:  #0f1117
Surface:     #1e2130
Border:      #2d3350
Text muted:  #64748b / #475569 / #94a3b8
Purple:      #818cf8   (métricas gerais)
Green:       #34d399   (sucesso / IBBX)
Red:         #f87171   (erro / externo)
Blue:        #60a5fa   (info)
Teal:        #2dd4bf   (p95 / tempo)
Orange:      #fb923c   (warning / 4xx)
```

### 10.1 Design tokens

- [x] Definir paleta de cores para dark e light mode baseada nas referências
- [x] Atualizar variáveis CSS em `index.css` com os novos tokens
- [x] Atualizar `tailwind.config` com as cores, tipografia e espaçamentos do novo estilo

### 10.2 Componentes base (shadcn/ui)

- [x] Revisar e customizar os componentes shadcn já existentes para o novo estilo
- [x] Garantir que todos os componentes funcionam corretamente em dark e light mode
- [x] Implementar toggle de dark/light mode no header com persistência (localStorage)

### 10.3 Layout e navegação

- [x] Redesenhar o layout geral — sidebar, header, área de conteúdo
- [x] Redesenhar o header com seletor de projeto e menu de usuário
- [x] Redesenhar a sidebar com navegação entre seções (dashboard, eventos, sessões, configurações)

### 10.4 Páginas

- [x] Redesenhar o dashboard principal (métricas, gráficos, event feed)
- [x] Redesenhar a página de login e setup inicial
- [x] Redesenhar a página de configurações (usuários, API Keys, projetos)
- [x] Redesenhar a página de sessões

---

## Pré-requisitos antes de escalar — fazer cedo

> Problemas pequenos que vão travar o crescimento se não forem resolvidos antes das fases maiores.

### Backend — substituir fmt por logger estruturado

Hoje o projeto usa `fmt.Printf` / `fmt.Println` em todo lugar. Em produção isso é inútil — sem nível de log, sem contexto, sem como filtrar. Trocar por `slog` (padrão da stdlib Go desde 1.21) antes de adicionar mais código.

- [x] Substituir todos os `fmt.Printf` / `fmt.Println` em `cmd/api/writer/main.go` por `slog`
- [x] Substituir todos em `cmd/api/reader/main.go`
- [x] Substituir todos em `cmd/api/worker/main.go`
- [x] Substituir todos em `internal/worker/service.go`
- [x] Substituir todos em `internal/worker/autoscale.go`
- [x] Substituir todos em `internal/worker/helpers.go`
- [x] Substituir todos em `internal/db/db.go`
- [x] Configurar nível de log via variável de ambiente (`LOG_LEVEL=debug|info|warn|error`)

### Backend — tratar panics no db.go

O `db.go` usa `panic` em 5 pontos diferentes (falha de config, migration, conexão). Em um servidor isso derruba o processo inteiro. Substituir por retorno de erro tratado no `main.go`.

- [x] Transformar `Init()` para retornar `(*gorm.DB, error)` em vez de usar `panic`
- [x] Tratar o erro no `main.go` de cada serviço com log + `os.Exit(1)` limpo
- [x] Idem para `RunMigrations()` — já retorna erro mas o caller faz `panic` em vez de tratar

### Versionamento da API

Prefixar todas as rotas com `/v1/` desde o início. Barato de fazer agora, caro de mudar depois quando o SDK já estiver em uso.

- [x] Adicionar prefixo `/v1` em todas as rotas do Writer (`/v1/audit`)
- [x] Adicionar prefixo `/v1` em todas as rotas do Reader (`/v1/audit`, `/v1/auth`, etc.)
- [x] Atualizar o frontend para usar as rotas versionadas
- [x] Documentar no README que a API é versionada (README.md, seção API Reference)

### Frontend — URL hardcoded e erros silenciosos

- [x] Remover `http://localhost:8080` hardcoded de `frontend/src/http/audit/list.tsx`
- [x] Criar variável de ambiente `VITE_API_URL` e usar em todas as chamadas HTTP
- [x] Adicionar tratamento de erro nas chamadas `useQuery` — exibir mensagem ao usuário em vez de tela em branco quando a API falhar
- [x] Separar camadas do frontend: `src/http/` para funções fetch, `src/queries/` para hooks `useQuery`/`useMutation`

---

## Fase 13 — Anomaly Detection

**Objetivo:** Detectar padrões anormais nos eventos de auditoria de forma proativa, sem depender de I.A. ou modelos externos — apenas análise estatística no Worker.

**Contexto:** Transforma o BatAudit de ferramenta reativa (consulta de logs) para proativa (detecção em tempo real). Quando uma anomalia é detectada, um evento do tipo `system.alert` é gerado e entra no próprio feed de auditoria.

### 13.1 Modelo de dados

- [x] Adicionar tipo de evento reservado `system.alert` ao modelo `Audit`
- [x] Criar tabela `anomaly_rules` (id, project_id, rule_type, threshold, window_seconds, active, created_at)
- [x] Criar migration para as tabelas acima

### 13.2 Engine de detecção (Worker)

> Análise estatística por janela de tempo (sliding window). Zero dependência externa.

- [x] Implementar sliding window por projeto — contador de eventos nos últimos N segundos
- [x] Detectar **pico de volume**: eventos por minuto > média + 3σ da última hora
- [x] Detectar **pico de erros**: taxa de 4xx/5xx > threshold configurável (ex: > 10% em 5 min)
- [x] Detectar **brute force**: mesmo `identifier` ou IP com > N falhas de autenticação em janela curta
- [x] Detectar **serviço silencioso**: projeto que normalmente gera eventos para de enviar por > X minutos
- [x] Detectar **deleção em massa**: > N eventos do tipo `*.delete` em janela curta
- [x] Ao detectar anomalia, gravar evento `system.alert` com `metadata` descrevendo o motivo

### 13.3 Configuração por projeto

- [x] Endpoint `GET /v1/anomaly/rules` — listar regras ativas do projeto
- [x] Endpoint `POST /v1/anomaly/rules` — criar/atualizar regra (threshold, janela, tipo)
- [x] Endpoint `DELETE /v1/anomaly/rules/:id` — desativar regra
- [x] Regras padrão criadas automaticamente ao criar um projeto

### 13.4 Dashboard

- [x] Card de anomalias no dashboard principal — contagem de alertas nas últimas 24h
- [x] Badge visual nos eventos do tipo `system.alert` no event feed (cor: vermelho/laranja)
- [x] Página de anomalias — lista de alertas com filtro por tipo e período

---

## Fase 14 — Notificações

**Objetivo:** Notificar proativamente quando anomalias são detectadas, sem depender de serviço externo ou configuração complexa.

**Contexto:** Apenas dois canais — Push Web (nativo do browser, zero config) e Webhook genérico (o usuário conecta onde quiser: Discord, Slack, Teams, n8n, Zapier, PagerDuty).

**Dependência:** Fase 13 (Anomaly Detection) deve estar concluída — as notificações são disparadas pelos eventos `system.alert`.

### 14.1 Modelo de dados

- [x] Criar tabela `notification_channels` (id, project_id, type `push|webhook`, config JSON, active, created_at)
- [x] Criar migration para a tabela acima

### 14.2 Push Web (browser notifications)

> Nativo do browser — funciona mesmo com a aba em background. Zero dependência externa.

- [x] Implementar Web Push API no frontend (service worker + `PushManager`)
- [x] Endpoint `POST /v1/notifications/push/subscribe` — salva subscription do browser
- [x] Endpoint `DELETE /v1/notifications/push/subscribe` — remove subscription
- [x] Worker envia push notification quando gera evento `system.alert`
- [x] Payload da notificação: tipo do alerta, projeto, timestamp, link direto para o evento
- [x] UI no dashboard: botão "Ativar notificações" com estado (ativo/inativo)

### 14.3 Webhook genérico

> O usuário configura uma URL e o BatAudit faz POST. Discord, Slack, Teams, n8n, Zapier — qualquer um.

- [x] Endpoint `POST /v1/notifications/webhooks` — cadastrar webhook (url, secret opcional para HMAC)
- [x] Endpoint `GET /v1/notifications/webhooks` — listar webhooks do projeto
- [x] Endpoint `DELETE /v1/notifications/webhooks/:id` — remover webhook
- [x] Worker faz POST na URL configurada quando gera evento `system.alert`
- [x] Payload padrão JSON: `{ event_type, project, message, timestamp, details }`
- [x] Assinatura HMAC-SHA256 no header `X-BatAudit-Signature` (opcional, se secret configurado)
- [x] Retry automático em caso de falha (3 tentativas com backoff)
- [x] Registrar histórico de entregas (sucesso/falha) na tabela `notification_deliveries`

### 14.4 Configuração no dashboard

- [x] Página de notificações em configurações do projeto
- [x] Seção Push Web: toggle ativar/desativar com status do browser
- [x] Seção Webhooks: listagem, formulário de cadastro, botão "Testar" (dispara payload de teste)
- [x] Histórico de entregas por webhook (últimas 50 entregas com status HTTP)

---

## Fase 15 — Export de Dados

**Objetivo:** Permitir que o usuário exporte eventos de auditoria para uso externo — relatórios de compliance, análise em ferramentas terceiras, backup manual.

**Contexto:** Feature simples de alto valor. O usuário filtra um período/serviço no dashboard e baixa o resultado. Sem configuração extra.

### 15.1 Backend

- [x] Endpoint `GET /v1/audit/export?format=csv&start_date=...&end_date=...` — aceita os mesmos filtros da listagem
- [x] Suporte a formato `csv` e `json`
- [x] Header `Content-Disposition: attachment; filename="bataudit-export-{date}.csv"`
- [x] Limitar export a no máximo 100.000 eventos por requisição (proteção de memória)
- [x] Para volumes maiores, retornar erro orientando a usar janelas de período menores

### 15.2 Frontend

- [x] Botão "Exportar" no event feed (ao lado dos filtros existentes)
- [x] Dropdown de formato: CSV / JSON
- [x] Exporta com os filtros ativos no momento — o que o usuário está vendo é o que será exportado
- [x] Feedback visual durante o download (loading state no botão)

---

## Fase 16 — Data Tiering (Retenção Inteligente)

**Objetivo:** Auditoria infinita sem crescimento ilimitado do banco — dados antigos são agregados em vez de deletados, mantendo o histórico estatístico para sempre.

**Contexto:** Cereja do bolo do BatAudit. Diferencial real frente a ferramentas que ou deletam ou deixam crescer. Especialmente valioso para compliance, onde o histórico importa mas o custo de infra também.

### 16.1 Modelo de dados

- [x] Criar tabela `audit_summaries` (period_start, period_type `hour|day`, project_id, service_name, status_2xx, status_3xx, status_4xx, status_5xx, avg_ms, p95_ms, event_count)
- [x] Criar migration para a tabela acima

### 16.2 Job de agregação (Worker)

> Job noturno que agrega eventos antigos e libera espaço no banco sem perder o histórico.

- [x] Implementar job agendado no Worker (configurável via env var `TIERING_SCHEDULE`, padrão: diário às 02h)
- [x] Agregar eventos com mais de `TIERING_RAW_DAYS` dias (padrão: 30) por `hora + projeto + serviço`
- [x] Gravar resultado em `audit_summaries` com `period_type = hour`
- [x] Agregar resumos com mais de `TIERING_HOURLY_DAYS` dias (padrão: 365) por `dia + projeto + serviço`
- [x] Gravar resultado em `audit_summaries` com `period_type = day`
- [x] Deletar eventos crus e resumos horários após agregação bem-sucedida
- [x] Logar volume de eventos processados e espaço liberado a cada execução

### 16.3 API

- [x] Endpoint `GET /v1/audit/stats/history` — retorna séries temporais mesclando dados crus + `audit_summaries`
- [x] Dashboard sabe automaticamente de qual fonte buscar dependendo do período selecionado

### 16.4 Configuração no frontend

- [x] Página de configurações do projeto — seção "Retenção de Dados"
- [x] Campo: *Manter eventos detalhados por* `[30]` dias
- [x] Campo: *Manter resumos horários por* `[365]` dias
- [x] Campo: *Manter resumos diários* `[para sempre]`
- [x] Indicador de uso: tamanho estimado dos dados do projeto no banco

---

## Fase 12 — CI/CD

**Objetivo:** Automatizar build, testes e deploy para garantir qualidade contínua e facilitar contribuições externas.

### 12.1 Pipeline de validação (em todo PR e push)

- [x] Criar workflow `.github/workflows/ci.yml`
- [x] Rodar `go vet ./...` e `golangci-lint` no backend
- [x] Rodar testes unitários (`go test ./...`)
- [x] Rodar testes de integração via `docker-compose.test.yml` (job `integration` no ci.yml)
- [x] Rodar lint e typecheck no frontend (`eslint`, `tsc --noEmit`)
- [x] Bloquear merge se qualquer etapa falhar

### 12.2 Build e publicação de imagens Docker

- [x] Criar workflow `.github/workflows/release.yml` disparado em tags (`v*`)
- [x] Build das imagens `writer`, `reader` e `worker`
- [x] Push para GitHub Container Registry (`ghcr.io/bataudit/*`)
- [x] Taggear imagens com versão semântica e `latest`

### 12.3 Deploy automático em staging

- [ ] Criar workflow de deploy disparado ao mergear na `main`
- [ ] Fazer SSH no servidor de staging e atualizar via `docker compose pull && docker compose up -d`
- [ ] Configurar secrets no GitHub Actions (`SSH_KEY`, `STAGING_HOST`, etc.)
- [ ] Notificar no canal de dev (Slack/Discord/email) ao fim do deploy

### 12.4 Path-based CI/CD (otimização)

- [ ] **CI backend** só roda quando arquivos fora de `frontend/` e `landing/` mudam (`paths:` no ci.yml)
- [ ] **CI frontend** só roda quando arquivos dentro de `frontend/` mudam
- [ ] **Release** (build das imagens Docker) só dispara quando `cmd/`, `internal/` ou arquivos Go do root mudam — não a cada mudança de frontend ou landing
- [ ] **Deploy landing** só dispara quando arquivos dentro de `landing/` mudam
- [ ] **Deploy demo** só dispara quando serviços backend (`cmd/`, `internal/`) mudam — imagem nova disponível no GHCR

### 12.5 Versionamento semântico

- [x] Adotar [Conventional Commits](https://www.conventionalcommits.org/) como padrão
- [x] Criar workflow que gera `CHANGELOG.md` e tag de versão automaticamente via `release-please` ou `semantic-release`

---

## Bugfixes (revisão de código)

Bugs identificados na revisão de código pós-implementação.

- [x] **CRÍTICO** — Remover método `RegisterRoutes` obsoleto em `internal/audit/handler.go` (deixar só `RegisterReadRoutes`)
- [x] **MÉDIO** — Corrigir typo em `event-card.tsx`: `h- w-4` → `h-4 w-4` (ícone `<User>` renderizava sem altura)
- [x] **MÉDIO** — Remover export `ALL_PROJECTS` não utilizado em `project-context.tsx` (`null` é usado para "Todos os projetos")
- [x] **MÉDIO** — Tratar erro ignorado `sqlDB, _ := conn.DB()` no reader e writer `main.go` (falha silenciosa no close)
- [x] **BAIXO** — `CreateUser` retornava `ErrEmailTaken` para qualquer erro de DB — corrigido para propagar erro real quando não é violação de unique constraint
- [x] **BAIXO** — `CreateProject` retornava `ErrSlugTaken` para qualquer erro de DB — corrigido idem

---

## Fase 11 — Melhorias gerais (backlog)

- [x] Adicionar endpoint `GET /audit/stats` — resumo agregado (total por serviço, por método, erros, etc.)
- [x] Suporte a ordenação na listagem (`sort_by`, `sort_order`)
- [x] Internacionalizar mensagens de erro — todas as mensagens do backend já estão em EN consistentemente

---

## Fase 17 — Demo: Landing Page

**Objetivo:** Página pública estática apresentando o BatAudit — o que é, features principais, como instalar, link para o demo online.

**Contexto:** Porta de entrada do projeto para quem chega pelo GitHub ou direto pela URL. Deve ser simples, rápida de carregar e comunicar o valor em segundos.

- [x] Página estática (HTML/CSS ou Next.js estático) hospedada via GitHub Pages ou Vercel
- [x] Seções: hero (tagline + CTA), features (cards), instalação (código), link para demo online
- [x] Design consistente com a paleta do dashboard (dark mode por padrão)
- [x] Badge "self-hosted" + "open source" no hero
- [x] Link para o repositório GitHub
- [x] Responsiva (mobile-friendly)

---

## Fase 18 — Demo: Ambiente Online

**Objetivo:** Instância pública do BatAudit rodando na nuvem com dados de seed, para qualquer pessoa explorar sem instalar nada.

**Contexto:** O usuário clica em "Ver demo" na landing page e já cai no dashboard com dados reais. Acesso de leitura apenas (sem login de escrita).

- [ ] Deploy do stack completo (Writer + Worker + Reader + PostgreSQL + Redis) em servidor público
- [ ] Seed automático ao subir: rodar `scripts/seed.go` para popular com ~3000 eventos
- [ ] Usuário demo pré-criado com role `viewer` (email: `demo@bataudit.dev` / senha: `demo`)
- [ ] Reset automático a cada 24h (cron job que re-roda o seed para manter dados frescos)
- [ ] Banner no dashboard: "Você está no ambiente de demonstração — dados são resetados diariamente"
- [ ] Bloquear operações destrutivas no usuário demo (não pode deletar projetos, API Keys, etc.)

---

## Fase 19 — Demo: One-Command Local

**Objetivo:** Qualquer desenvolvedor sobe o BatAudit completo com dados de exemplo com um único comando.

**Contexto:** Para quem quer testar localmente antes de decidir instalar de verdade. Zero configuração manual.

- [x] `docker-compose.demo.yml` — sobe toda a stack + roda seed automaticamente
- [x] Serviço `seeder` no compose que aguarda o banco ficar pronto e executa `seed.go`
- [x] Usuário demo criado automaticamente via `INITIAL_OWNER_*` env vars no compose
- [x] Comando único documentado no README:
  ```bash
  docker compose -f docker-compose.demo.yml up
  # Dashboard disponível em http://localhost:8082/app
  # Login: demo@bataudit.dev / demo
  ```
- [x] `.env.demo` com todas as variáveis pré-configuradas (sem nada para o usuário editar)
- [x] Seção "Quick Demo" no README com o comando acima em destaque

---

## Fase 20 — Seed de Anomalias para Testes

**Objetivo:** Facilitar testes da detecção de anomalias sem precisar esperar eventos reais ou configurar manualmente.

**Contexto:** O worker analisa eventos e dispara alertas (`system.alert`) com base nas regras de anomalia do projeto. Para testar o fluxo completo (worker → alerta → dashboard), precisamos de dois modos de seed.

- [x] **Modo 1 — seed completo (one-shot):** `cmd/tools/seed-anomalies/main.go`
  - Insere rajadas de eventos que violam cada regra + cria os `system.alert` diretamente no DB
  - Cobre todos os 5 tipos: `brute_force`, `error_rate`, `mass_delete`, `volume_spike`, `silent_service`
  - Garante que as regras do projeto demo existam antes de inserir

- [x] **Modo 2 — seed contínuo (streaming):** `cmd/tools/seed-stream/main.go`
  - Flags: `--project` (API key, obrigatório), `--rate` (eventos/s, default 2), `--duration` (segundos, 0 = infinito), `--writer` (URL, default http://localhost:8081)
  - Alterna tráfego normal e rajadas anômalas a cada 30s (cicla pelos 4 tipos de burst)
  - O worker detecta em tempo real e gera os alertas

**Como rodar:**
```powershell
# Modo 1 — seed histórico com anomalias (requer DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)
$env:DB_HOST="localhost"; $env:DB_USER="bat"; $env:DB_PASSWORD="bat"; $env:DB_NAME="bataudit"
go run .\cmd\tools\seed-anomalies\main.go

# Modo 2 — streaming contínuo via Writer (stack deve estar rodando)
go run .\cmd\tools\seed-stream\main.go --rate 5 --project bat_<sua_api_key>

# Modo 2 com duração limitada
go run .\cmd\tools\seed-stream\main.go --rate 3 --duration 120 --project bat_<sua_api_key>
```

---

## Ordem sugerida de execução

```
Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5.1 → Fase 6 → Fase 5.2 → Fase 7 → Fase 8 → Fase 9 → Fase 10 → Fase 11 → Fase 13 → Fase 14 → Fase 15 → Fase 16 → Fase 19 → Fase 17 → Fase 18 → Fase 12
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
- Fase 13 (anomaly detection) depende da Fase 6 (dashboard) estar pronta para exibir os alertas
- Fase 14 (notificações) depende da Fase 13 (anomaly detection) — notifica com base nos eventos `system.alert`
- Fase 15 (export) pode ser feita em qualquer momento após a Fase 6, mas faz mais sentido depois dos filtros estarem maduros
- Fase 16 (data tiering) é a cereja do bolo — deixar para o final, depois de tudo estável
- Fase 19 (demo local) depende do projeto estar estável — Fase 10 concluída no mínimo
- Fase 17 (landing page) depende da Fase 19 (demo local) e Fase 18 (demo online) para ter os links certos
- Fase 18 (demo online) depende da Fase 12 (CI/CD) para ter pipeline de deploy automatizado
- Fase 12.1 (CI) pode ser iniciada a qualquer momento, mas o valor máximo vem depois da Fase 9 (testes) estar pronta
- Fase 12.2 e 12.3 (build + deploy) fazem mais sentido após a Fase 3 (autenticação) e antes de lançar os SDKs públicos (Fase 7/8)

---

## Fase 21 — Healthcheck Monitor

**Objetivo:** Configurar URLs de healthcheck por projeto e ter o BatAudit pingando periodicamente — fechando o loop entre auditoria ("o que aconteceu") e uptime ("o app ainda está de pé").

**Contexto:** Times pequenos usam Betterstack ou UptimeRobot separado do audit log. O BatAudit já tem Worker, notificações e eventos `system.*` — healthcheck se encaixa naturalmente sem nova infraestrutura.

### 21.1 Modelo de dados

- [ ] Criar tabela `healthcheck_monitors` (id, project_id, name, url, interval_seconds, timeout_seconds, expected_status, enabled, last_status `up|down|unknown`, last_checked_at, created_at, updated_at)
- [ ] Criar tabela `healthcheck_results` (id, monitor_id, status `up|down`, status_code, response_ms, error, checked_at)
- [ ] Criar migration para as tabelas acima
- [ ] Limite: máximo 10 monitors por projeto (validar no handler)

### 21.2 Backend — endpoints (Reader, protegidos por JWT)

- [ ] `POST /v1/monitors` — criar monitor (name, url, interval_seconds, timeout_seconds, expected_status)
- [ ] `GET /v1/monitors` — listar monitors do projeto com `last_status` e `last_checked_at`
- [ ] `PUT /v1/monitors/:id` — editar monitor
- [ ] `DELETE /v1/monitors/:id` — remover monitor
- [ ] `GET /v1/monitors/:id/history` — últimos N resultados do monitor (paginado)

### 21.3 Worker — goroutine de polling

- [ ] Criar `internal/healthcheck/monitor.go` — lógica de polling por monitor
- [ ] Goroutine `runHealthcheckMonitors` iniciada no `cmd/api/worker/main.go`
- [ ] Ao iniciar: carregar todos os monitors ativos do banco
- [ ] Recarregar configs a cada 60s (novos monitors adicionados via dashboard entram automaticamente)
- [ ] Para cada monitor: `time.Ticker` com o `interval_seconds` configurado
- [ ] A cada tick: fazer `GET` na URL com timeout configurado
- [ ] Avaliar: status code == expected_status → UP, caso contrário → DOWN
- [ ] Atualizar `last_status` e `last_checked_at` na tabela `healthcheck_monitors`
- [ ] Inserir resultado em `healthcheck_results`
- [ ] Manter apenas os últimos 200 resultados por monitor (limpar os mais antigos)

### 21.4 Eventos e notificações

- [ ] Na transição UP→DOWN: gravar evento `system.healthcheck.down` no audit log (campos: `url`, `status_code`, `response_ms`, `error`, `expected_status`)
- [ ] Na transição DOWN→UP: gravar evento `system.healthcheck.up` (campos: `url`, `status_code`, `response_ms`, `downtime_seconds`)
- [ ] Só notifica na transição de estado — não a cada check falho (sem spam)
- [ ] Disparar notificação via sistema existente (Web Push + Webhook) igual às anomalias
- [ ] Payload da notificação: `"[NomeDoMonitor] está unhealthy — /health retornou 503 (esperado 200)"`
- [ ] Recovery notification opcional (configurável por monitor)

### 21.5 Dashboard

- [ ] Tabela de breakdown por serviço (Fase 6.3) ganha coluna `Health` — badge colorido: 🟢 UP / 🔴 DOWN / ⚪ sem monitor
- [ ] Badge usa `last_status` do monitor associado ao `service_name`
- [ ] Página de configurações → nova seção "Healthcheck Monitors"
  - [ ] Listagem de monitors com status atual, URL, intervalo, último check
  - [ ] Formulário de criação/edição
  - [ ] Botão "Testar agora" — dispara um check imediato e exibe o resultado
  - [ ] Toggle ativar/desativar por monitor

---

## Fase 22 — Error Rate por Rota

**Objetivo:** Detector novo que calcula taxa de erro por rota em tempo real. Quando uma rota estoura erros, o time vê antes de qualquer reclamação de usuário — e sabe exatamente quem foi afetado.

**Contexto:** A Fase 13 detecta anomalias de volume geral e taxa de erro global. Esta fase adiciona granularidade: por rota específica. É o maior caso de uso do BatAudit — "saber que o João tentou fazer checkout 3 vezes e falhou antes de ele abrir ticket".

**Dependência:** Fase 13 (Anomaly Detection) concluída.

### 22.1 Detector no Worker

- [ ] Criar detector `error_rate_by_route` em `internal/anomaly/`
- [ ] Sliding window por `(project_id, path, method)` nos últimos X minutos (configurável, padrão: 5min)
- [ ] Calcular: `erros (4xx+5xx) / total requests` por rota
- [ ] Threshold configurável por projeto (padrão: >10% de taxa de erro com mínimo de 10 requests na janela)
- [ ] Ao ultrapassar threshold: gravar evento `system.alert` com `rule_type: "error_rate_by_route"` e `metadata`: `{ path, method, error_rate, total_requests, error_count, window_seconds }`
- [ ] Cooldown: não gerar novo alerta para a mesma rota por 10min após o primeiro

### 22.2 Backend — usuários afetados

- [ ] Endpoint `GET /v1/audit/affected-users?path=...&method=...&start=...&end=...`
- [ ] Retorna lista de `{ identifier, user_email, user_name, error_count, last_seen }` que bateram na rota com erro no período
- [ ] Ordenado por `error_count` desc
- [ ] Usado pelo dashboard normal (não pelo wallboard) para ação proativa de suporte

### 22.3 Dashboard

- [ ] Card "Rotas com problema" na página de anomalias — lista rotas com `error_rate_by_route` ativo nas últimas 24h
- [ ] Ao clicar numa rota → drawer/modal com lista de usuários afetados (`GET /v1/audit/affected-users`)
- [ ] Exibir: `identifier`, `user_email`, `error_count`, `last_seen` — contexto completo para suporte proativo

---

## Fase 23 — Wallboard (TV Dashboard)

**Objetivo:** Rota `/tv` com layout pensado para TV ou monitor do escritório — leitura de longe, sem interação, atualização automática. Em 3 segundos olhando pra tela, qualquer pessoa sabe se tem algo errado.

**Dependências:** Fase 21 (Healthcheck Monitor) para badges de saúde. Fase 22 (Error Rate por Rota) para rotas em evidência.

### 23.1 Auth read-only (novo tipo de token)

- [ ] Novo tipo de token `display_token` na tabela `api_keys` (ou tabela separada `display_tokens`)
- [ ] Campos: id, project_id, token_hash, expires_at (padrão: 30 dias), created_at
- [ ] Endpoint `POST /v1/display-tokens` — gerar token read-only para o projeto
- [ ] Endpoint `DELETE /v1/display-tokens/:id` — revogar token
- [ ] Middleware `DisplayTokenMiddleware` — valida o token, injeta project_id no contexto, só permite rotas de leitura
- [ ] Gerar QR Code no frontend a partir da URL completa (`/tv?token=...`) — usar biblioteca client-side (ex: `qrcode`)
- [ ] Alternativa de acesso: código de 6 dígitos alfanumérico exibido junto ao QR

### 23.2 Backend — endpoints para o wallboard

- [ ] `GET /v1/wallboard/summary` — retorna: eventos hoje, erros hoje, sessões ativas (protegido por DisplayTokenMiddleware)
- [ ] `GET /v1/wallboard/feed` — últimos 20 eventos (method, path, status_code, response_ms, service_name) para o feed ao vivo
- [ ] `GET /v1/wallboard/volume` — série temporal das últimas 2h por bucket de 5min
- [ ] `GET /v1/wallboard/health` — lista de monitors com `last_status` e `response_ms`
- [ ] `GET /v1/wallboard/alerts` — anomalias ativas (geradas nas últimas 30min, não resolvidas)
- [ ] `GET /v1/wallboard/error-routes` — rotas com error rate ativo (da Fase 22)
- [ ] Todos os endpoints aceitam `display_token` via query param ou header `X-Display-Token`

### 23.3 Frontend — rota `/tv`

- [ ] Nova rota `/tv` no TanStack Router — layout completamente diferente do dashboard normal
- [ ] Sem sidebar, sem header de navegação — fullscreen
- [ ] Auto-refresh global a cada 10s (polling de todos os endpoints do wallboard)
- [ ] Dark mode sempre ativo independente da preferência do usuário
- [ ] Font size aumentado — legível de 2-3 metros

**Blocos do layout:**
- [ ] Header: nome do projeto + relógio em tempo real + indicador de "última atualização"
- [ ] Contadores grandes: total eventos hoje, erros hoje, sessões ativas
- [ ] Badges de saúde por serviço (UP/DOWN com cor imediata) — dados da Fase 21
- [ ] Feed ao vivo: últimos eventos rolando, badge de status com cor semântica, ❌ em erros
- [ ] Gráfico de volume das últimas 2h (barras simples, sem interação)
- [ ] Banner de anomalia: aparece na base da tela em laranja/vermelho pulsando quando há alerta ativo — some sozinho quando passa
- [ ] Card de rotas em evidência: vermelho pulsando com nome da rota + taxa de erro — aparece só quando há `error_rate_by_route` ativo
- [ ] Auto-rotate entre projetos se o token for de owner com múltiplos projetos (intervalo configurável)

**Configuração no dashboard normal:**
- [ ] Settings → nova seção "Wallboard" com botão "Gerar link de acesso"
- [ ] Exibe QR Code + URL copiável + código de 6 dígitos
- [ ] Botão "Revogar acesso" para invalidar o token atual

---

## Fase 24 — Relatório Mês a Mês

**Objetivo:** Comparativo automático mês anterior vs atual para managers e tech leads — sem precisar pedir para o dev "me manda um resumo do mês".

**Contexto:** `audit_summaries` da Fase 16 já tem dados agregados por dia. Esta fase consome esses dados e apresenta a evolução temporal de forma legível por qualquer pessoa.

### 24.1 Backend

- [ ] Endpoint `GET /v1/reports/monthly?month=2026-03` — retorna comparativo do mês solicitado vs mês anterior
- [ ] Campos retornados:
  - `total_events`: mês atual vs anterior + variação percentual
  - `total_errors`: mês atual vs anterior + variação percentual
  - `error_rate`: taxa geral + variação
  - `avg_response_ms`: tempo médio + variação
  - `top_error_routes`: top 5 rotas com mais erros no mês (path, method, error_count, error_rate)
  - `most_affected_users`: top 5 usuários que mais encontraram erros (identifier, error_count)
  - `weekly_breakdown`: volume de eventos por semana do mês (para o gráfico de evolução)
  - `services_summary`: por serviço — eventos, erros, avg_ms
- [ ] Fonte de dados: `audit_summaries` com `period_type = day` (já existe da Fase 16)
- [ ] Fallback para eventos crus se o tiering ainda não rodou no mês corrente

### 24.2 Dashboard

- [ ] Nova página "Relatórios" no sidebar
- [ ] Seletor de mês (mês atual por padrão)
- [ ] Cards de comparativo: valor do mês + delta vs mês anterior com seta ↑↓ e cor (verde = melhora, vermelho = piora)
  - Total de eventos (crescimento de uso — neutro)
  - Total de erros (vermelho se subiu, verde se caiu)
  - Taxa de erro geral
  - Tempo médio de resposta
- [ ] Gráfico de linha: evolução semanal de eventos vs erros no mês
- [ ] Tabela "Top rotas com erro no mês" — path, método, contagem, taxa
- [ ] Tabela "Usuários mais afetados" — identifier, email, contagem de erros
- [ ] Botão "Exportar relatório" — gera CSV/PDF com todos os dados (usa export da Fase 15 como base)

---

## Fase 25 — Publicação dos SDKs no npm + CI/CD

**Objetivo:** Publicar `@bataudit/node` e `@bataudit/browser` no npm e automatizar publicações futuras via GitHub Actions.

**Contexto:** Os SDKs existem e têm testes, mas nunca foram publicados. A documentação referencia `@bataudit/sdk` em alguns lugares — isso precisa ser corrigido para `@bataudit/node` e `@bataudit/browser` antes de publicar para não confundir quem for instalar.

### 25.1 Corrigir referências na documentação

- [ ] Buscar todas as ocorrências de `@bataudit/sdk` no repo (`README.md`, `docs/`, `landing/`, `sdks/`) e corrigir para o nome correto do pacote (`@bataudit/node` ou `@bataudit/browser` conforme o contexto)

### 25.2 Ajustar package.json dos dois SDKs

- [ ] Adicionar campo `repository` nos dois `package.json`:
  ```json
  "repository": { "type": "git", "url": "https://github.com/joaovrmoraes/bataudit" }
  ```
- [ ] Adicionar campo `license`: `"MIT"`
- [ ] Adicionar campo `homepage` apontando para o README do SDK
- [ ] Adicionar campo `bugs` apontando para as issues do GitHub
- [ ] Adicionar campo `publishConfig`: `{ "access": "public" }`
- [ ] Verificar campo `files` — garantir que só `dist/` vai pro npm (sem `src/`, sem `tests/`)
- [ ] Adicionar script `"prepublishOnly": "npm run build && npm test"` — garante build + testes antes de qualquer publish

### 25.3 Garantir que o build funciona

- [ ] Rodar `pnpm build` em `sdks/node/` — verificar que `dist/` é gerado corretamente com `.js` + `.d.ts`
- [ ] Rodar `pnpm build` em `sdks/browser/` — idem
- [ ] Rodar `pnpm test` em ambos — os 27 + 25 testes devem passar
- [ ] Fazer dry-run do publish: `npm publish --dry-run` em cada SDK para ver o que seria enviado

### 25.4 Primeira publicação manual

- [ ] Criar conta no npm (se ainda não tiver) e criar a org `@bataudit`
- [ ] Logar via `npm login`
- [ ] Publicar `@bataudit/node`: `cd sdks/node && npm publish`
- [ ] Publicar `@bataudit/browser`: `cd sdks/browser && npm publish`
- [ ] Verificar no npmjs.com que os pacotes aparecem corretamente

### 25.5 CI/CD — workflow de publicação automática

- [ ] Criar `.github/workflows/publish-sdk.yml`
- [ ] Disparar em tags com padrão `sdk-v*` (ex: `sdk-v0.1.1` publica os dois) ou padrões separados `sdk-node-v*` e `sdk-browser-v*`
- [ ] Jobs:

```yaml
# Estrutura do workflow
on:
  push:
    tags:
      - 'sdk-v*'        # publica os dois juntos
      - 'sdk-node-v*'   # publica só o node
      - 'sdk-browser-v*' # publica só o browser

jobs:
  publish-node:
    if: startsWith(github.ref, 'refs/tags/sdk-v') || startsWith(github.ref, 'refs/tags/sdk-node-v')
    steps:
      - checkout
      - setup node com registry npmjs
      - pnpm install em sdks/node/
      - pnpm test
      - pnpm build
      - npm publish (usando NPM_TOKEN do GitHub secret)

  publish-browser:
    if: startsWith(github.ref, 'refs/tags/sdk-v') || startsWith(github.ref, 'refs/tags/sdk-browser-v')
    steps: (mesmo padrão)
```

- [ ] Adicionar secret `NPM_TOKEN` no GitHub repo (gerar em npmjs.com → Access Tokens → Automation)
- [ ] Adicionar detecção de mudanças nos SDKs no `ci.yml` — rodar testes de `sdks/node/` e `sdks/browser/` quando arquivos em `sdks/` mudam

### 25.6 Versionamento dos SDKs

- [ ] Definir estratégia: versionar SDKs junto com o backend (`v1.2.0`) ou independente
- [ ] Documentar no `CONTRIBUTING.md` como fazer release de SDK (criar tag `sdk-v0.2.0`)

---

## ~~Fase 26 — Usage Analytics (Rankings)~~ ✅ CONCLUÍDO

**Objetivo:** Aba "Insights" no dashboard com rankings de uso — quais endpoints são mais acessados, quais usuários são mais ativos, quais rotas têm mais erro e mais latência. Voltado para devs e produto.

**Contexto:** Zero migration necessária — todos os dados já existem em `audit_events`. Backend é `GROUP BY` simples. Frontend é uma tela nova com período selecionável.

### 26.1 Backend

- [x] Endpoint `GET /v1/audit/insights` — retorna os 4 rankings em uma única chamada (top_endpoints, top_users, top_error_routes, top_slow_routes), filtrável por `?period=7d|30d|90d` e `?project_id=`
- [x] Tipos adicionados ao `model.go`: `InsightFilters`, `TopEndpoint`, `TopUser`, `TopErrorRoute`, `TopSlowRoute`, `InsightsResult`
- [x] `GetInsights()` adicionado à interface `Repository` e implementado em `repository.go`
- [x] Service e handler atualizados; rota `GET /audit/insights` registrada no Reader

### 26.2 Frontend

- [x] `src/http/audit/insights.ts` — fetch + tipos
- [x] `useInsights()` hook adicionado em `src/queries/audit.ts`
- [x] `src/routes/app/_layout/insights.tsx` — página com seletor de período (7d/30d/90d) + 4 ranking cards (2×2)
- [x] Sidebar atualizada com link "Insights" + ícone `BarChart2`
- [x] `routeTree.gen.ts` atualizado com a nova rota

---

## Fase 31.1 — Personal Access Token (PAT)

**Objetivo:** Criar um tipo de token de longa duração para autenticar a CLI e qualquer acesso programático ao Reader — sem depender de JWT (que expira) nem de API Key (que é só para o Writer).

**Contexto:** JWT expira em horas — inviável para CLI. API Keys autenticam no Writer para enviar eventos, não no Reader para ler. Modelo igual ao GitHub (`ghp_xxx`) e AWS (Access Key ID) — gerado uma vez no dashboard, salvo em `~/.bataudit/config`, nunca expira (ou tem expiração longa configurável).

### 31.1.1 Modelo de dados

- [ ] Criar tabela `access_tokens` (id, user_id, project_id, name, token_hash, scopes `read|write|admin`, expires_at nullable, last_used_at, created_at)
- [ ] Prefixo do token: `bat_cli_` para diferenciação visual
- [ ] Criar migration para a tabela acima

### 31.1.2 Backend

- [ ] Endpoint `POST /v1/access-tokens` — gerar PAT (nome + scopes + expiração opcional). Retorna o token em plain text uma única vez.
- [ ] Endpoint `GET /v1/access-tokens` — listar tokens do usuário (sem revelar o valor)
- [ ] Endpoint `DELETE /v1/access-tokens/:id` — revogar token
- [ ] Middleware no Reader que aceita `Authorization: Bearer bat_cli_xxx` além do JWT atual
- [ ] Middleware valida hash do token, verifica scopes e `expires_at`

### 31.1.3 Dashboard

- [ ] Settings → nova seção "Access Tokens"
- [ ] Formulário: nome + scopes (read / write) + expiração opcional
- [ ] Exibir token gerado uma única vez (igual API Keys)
- [ ] Listagem com nome, scopes, último uso, expiração, botão revogar

---

## Fase 31.2 — BatAudit CLI

**Objetivo:** CLI para consultar eventos, filtrar logs, monitorar anomalias e sessões direto do terminal — igual ao AWS CloudWatch CLI. Permite jogar output para uma IA analisar.

**Contexto:** Nenhuma ferramenta self-hosted de audit log tem CLI. Diferencial real. Devs já sabem usar CLIs no estilo AWS/GitHub. O caso de uso "jogar para IA analisar" é genuinamente novo.

**Dependência:** Fase 31.1 (PAT) — a CLI autentica via `bat_cli_xxx` token.

### 31.2.1 Stack

- TypeScript + Node.js — publicado no npm como `@bataudit/cli` (instalável com `npm i -g`, `pnpm add -g`, `yarn global add`)
- `commander` — parsing de comandos e flags
- `clack` — só para o wizard interativo de `bataudit configure`
- `chalk` — output colorido
- Localizado em `sdks/cli/` no mesmo repo

### 31.2.2 Configuração (`bataudit configure`)

- [ ] Wizard interativo via `clack`: URL do servidor + token PAT + nome do perfil
- [ ] Salvar em `~/.bataudit/config` no formato TOML com suporte a múltiplos perfis:
  ```toml
  [default]
  url = https://bataudit.meuservidor.com
  token = bat_cli_xxxx

  [staging]
  url = http://staging:8082
  token = bat_cli_yyyy
  ```
- [ ] Flag global `--profile <nome>` para usar perfil alternativo
- [ ] `bataudit whoami` — exibe usuário e projeto do token configurado

### 31.2.3 Comandos — Events

- [ ] `bataudit events list` — lista eventos (paginado, 50 por padrão)
- [ ] Flags: `--service`, `--environment`, `--method`, `--status`, `--from`, `--to`, `--limit`, `--project`
- [ ] `bataudit events get <id>` — detalhes completos de um evento
- [ ] `bataudit events tail` — polling contínuo de eventos novos (estilo `tail -f`)
- [ ] Flag `--output json` em todos os comandos — para pipe com `jq` ou jogar para IA

### 31.2.4 Comandos — Sessions

- [ ] `bataudit sessions list` — lista sessões derivadas
- [ ] Flags: `--identifier`, `--service`, `--from`, `--to`
- [ ] `bataudit sessions get <id>` — eventos da sessão em ordem cronológica

### 31.2.5 Comandos — Anomalies

- [ ] `bataudit anomalies list` — lista alertas `system.alert` recentes
- [ ] Flags: `--rule-type`, `--from`, `--to`, `--limit`
- [ ] `bataudit anomalies watch` — polling contínuo de novos alertas

### 31.2.6 Comandos — Stats

- [ ] `bataudit stats` — resumo do projeto (total, erros, avg response time, serviços ativos)
- [ ] Flags: `--environment`, `--project`

### 31.2.7 CI/CD

- [ ] Criar `publish-cli.yml` — publicar `@bataudit/cli` no npm em tags `cli-v*`
- [ ] Documentar no Docusaurus — seção "CLI" com todos os comandos e exemplos

---

## Backlog — Melhorias Pontuais

- [ ] **Filtro por `environment` no dashboard** — adicionar selector de environment (prod, staging, dev, local, testing) na página de eventos/audit list, integrado com o filtro `?environment=` já existente na API (`GET /v1/audit`)

---

## Fase 29 — Performance: Indexes + Query Optimization

**Objetivo:** Tornar o dashboard responsivo mesmo com 1M+ eventos — sem cache, sem infraestrutura extra. Fix cirúrgico nas queries e na estrutura do banco.

**Contexto:** Com volumes grandes, o carregamento inicial do dashboard é lento por dois motivos ortogonais: (1) a tabela `audits` não tem indexes nas colunas filtradas — cada query faz seq scan; (2) o `GetStats()` executa 5 queries separadas por chamada, incluindo `PERCENTILE_CONT(0.95)` que exige full scan. Cache não é a solução — BatAudit é audit log em tempo real, cache desatualizado quebra a proposta.

### 29.1 Migration — indexes na tabela `audits` (PostgreSQL)

- [ ] Criar migration `000009_add_performance_indexes.up.sql`
- [ ] `CREATE INDEX CONCURRENTLY idx_audits_project_timestamp ON audits(project_id, timestamp DESC)` — cobre 99% dos filtros: todo query combina project + orderBy timestamp
- [ ] `CREATE INDEX CONCURRENTLY idx_audits_project_status ON audits(project_id, status_code)` — stats de erros
- [ ] `CREATE INDEX CONCURRENTLY idx_audits_project_service ON audits(project_id, service_name)` — breakdown por serviço
- [ ] `CREATE INDEX CONCURRENTLY idx_audits_project_environment ON audits(project_id, environment)` — filtro de environment (Bug P7)
- [ ] `CREATE INDEX CONCURRENTLY idx_audits_project_event_type ON audits(project_id, event_type)` — filtro de anomalias (`system.alert`)
- [ ] Criar migration `000009_add_performance_indexes.down.sql` com os `DROP INDEX` correspondentes
- [ ] Repetir os mesmos indexes nas migrations SQLite em `internal/db/migrations/sqlite/000009_*` (sem `CONCURRENTLY` — SQLite não suporta)

### 29.2 Otimizar `GetStats()` no repository

- [ ] Consolidar as 5 queries separadas em 1 query com CTEs (ou 2 no máximo)
- [ ] Substituir `PERCENTILE_CONT(0.95)` por `PERCENTILE_DISC(0.95)` — discreto é mais rápido e suficiente para p95 de response time
- [ ] Garantir que todas as queries de stats usam os indexes adicionados (checar com `EXPLAIN ANALYZE`)
- [ ] Adicionar `LIMIT` nas subqueries de breakdown por serviço e método (top 20 já é suficiente para o dashboard)

### 29.3 Otimizar carregamento do dashboard

- [ ] Avaliar remover `useAuditHistory()` do carregamento inicial — o gráfico de histórico pode carregar lazy (só quando visível ou com `enabled: false` até o usuário rolar)
- [ ] Avaliar remover `useOrphans()` do carregamento inicial — widget de orphans pode ter `staleTime` maior (5min) já que não é crítico

---

## Bugfix Backlog

### 🚨 PRIORIDADE 1 — 🐳 Docker / Docker Compose

> Esses três itens são um único PR. Resolver juntos. Bloqueia qualquer pessoa de rodar em produção.

- [x] **`docker-compose.yml` desatualizado — dividido em dois arquivos sem necessidade** — o `docker-compose.yml` só tem Postgres e Redis (esqueleto antigo). O arquivo real e completo é o `docker-compose.services.yml`, que já tem Writer, Reader, Worker, healthchecks e `depends_on: service_healthy`. Ninguém que clonar o repo vai saber que precisa rodar o `services.yml`. Fix: mesclar tudo no `docker-compose.yml` (torná-lo o arquivo completo de produção) e deletar o `docker-compose.services.yml`.
- [x] **`docker-compose.yml` não carrega `.env`** — os arquivos `.yml` (incluindo `docker-compose.coolify.yml`) não estão lendo as variáveis do `.env` corretamente. Verificar uso de `env_file:` vs `environment:` vs `--env-file` e garantir que todos os serviços recebem as variáveis esperadas.
- [x] **Todos os serviços sobem ao mesmo tempo — spike de CPU/RAM na inicialização** — o Compose sobe PostgreSQL, Redis, Writer, Reader e Worker em paralelo. Durante o boot do Postgres (incluindo migrations) a máquina topa, inviabilizando deploy em instâncias pequenas como t3.micro. Fix: `healthcheck` real no `postgres` e `redis`, `depends_on: condition: service_healthy` nos demais. Após iniciado, o BatAudit é leve e roda tranquilo num t3.micro.

### ~~🔴 PRIORIDADE 2 — 🔐 Autenticação — Token Expirado~~ ✅ RESOLVIDO

- [x] **Sem refresh token e sem auto-logout** — implementado auto-logout no frontend: `isTokenExpired()` decodifica o JWT e verifica `exp`; `isAuthenticated()` chama `clearAuth()` se expirado; `fetchWithAuth` centraliza o header de `Authorization` e redireciona para `/login` em qualquer 401. Todos os arquivos `src/http/` foram migrados para `fetchWithAuth`.

### ~~🔴 PRIORIDADE 3 — 🔑 API Keys~~ ✅ RESOLVIDO

- [x] **Validação de `environment` travada** — o campo `environment` dos eventos de auditoria só aceitava: `production, staging, development, testing, local`. Corrigido: `validateEnvironment` agora aceita qualquer string no formato `[a-zA-Z0-9][a-zA-Z0-9\-_.]{0,99}` (qa, alpha, homolog, preview, ci, etc.). Testes atualizados.

### ~~🟡 PRIORIDADE 4 — 🔔 Push Notifications~~ ✅ RESOLVIDO

- [x] **Web Push não estava funcionando** — 4 bugs corrigidos: (1) `GenerateVAPIDKeys` wrapper retornava (priv, pub) ao invés de (pub, priv) — a biblioteca retorna `(privateKey, publicKey)` e o wrapper não compensava; (2) VAPID keys não estavam no `.env` nem nos compose files — Worker recebia strings vazias e rejeitava com "VAPID keys not configured"; (3) `subscribePush` era `Promise<void>` e descartava o channel UUID retornado pelo backend; (4) frontend armazenava `sub.endpoint` em vez do `channel.id` para o unsubscribe. Adicionado `useEffect` que detecta subscription existente via `pushManager.getSubscription()` ao montar, persistindo o `channel.id` no `localStorage`.

### ~~🟡 PRIORIDADE 5 — 📚 Documentação (Docusaurus)~~ ✅ RESOLVIDO

- [x] **Tutorial de produção** — `self-hosting/production.md` reescrito: setup completo com `.env`, VAPID keys, reverse proxy (Caddy + Nginx), Coolify, backups, upgrade e security checklist.
- [x] **Tutorial de setup com PostgreSQL** — `self-hosting/postgresql.md` criado: quando usar, env vars, compose bundled, PostgreSQL externo, SSL, backups, performance tips.
- [x] **Tutorial de setup com SQLite** — `self-hosting/sqlite.md` criado: quando usar, compose mínimo sem PostgreSQL, rodando sem Docker, migrations, backups, limitações. `cmd/tools/gen-vapid` criado para gerar VAPID keys. `configuration.md` atualizado com `SQLITE_PATH` e link correto para gen-vapid. Sidebars atualizado.

### ~~🔴 PRIORIDADE 7 — 🔍 Environment filter não aplica no Stats endpoint~~ ✅ RESOLVIDO

- [x] **`GetStats()` ignorava o filtro de environment** — handler `Stats()` agora lê `environment` query param e passa para `service.GetStats(projectID, environment)`. Repository `GetStats()` recebe ambos e aplica `WHERE environment = ?` em todas as subqueries (base closure + timeline). Timeline migrada para usar `base()` ao invés de query manual duplicada. Testes atualizados + `TestGetStats_ForwardsEnvironment` adicionado.

### ~~🔴 PRIORIDADE 8 — 📦 SDK: `path_params` nunca capturado~~ ✅ FALSO POSITIVO

- [x] **`path_params` já implementado** — Express (`express.ts:52`) e Fastify (`fastify.ts:58`) já capturam `req.params` / `request.params` corretamente. Os dados pareciam vazios no demo porque os seeds inserem direto no banco sem passar pelo SDK. Nenhuma correção necessária.

### ~~🟢 PRIORIDADE 6 — 🗄️ SQLite — Suporte alternativo ao PostgreSQL~~ ✅ RESOLVIDO

- [x] **Suporte a SQLite via GORM** — migrations SQLite criadas em `internal/db/migrations/sqlite/` (16 arquivos up/down) com tipos compatíveis: `JSONB→TEXT`, `TIMESTAMPTZ→DATETIME`, `DEFAULT NOW()→DEFAULT CURRENT_TIMESTAMP`, `UUID PRIMARY KEY DEFAULT gen_random_uuid()→TEXT PRIMARY KEY`. `RunMigrations` agora usa o diretório correto por driver. WAL mode + busy_timeout aplicados via GORM `Exec` após conexão. `SQLITE_PATH` tem default `bataudit.db`. Smoke test: todas as 10 tabelas criadas corretamente com `DB_DRIVER=sqlite`.

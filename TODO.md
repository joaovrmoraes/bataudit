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

- [ ] Adicionar campo `session_id` opcional ao modelo `Audit`
- [ ] Criar migration para adicionar a coluna `session_id`
- [ ] Criar endpoint `GET /audit/sessions/:session_id` — detalhes de uma sessão específica
- [ ] Calcular duração via `max(timestamp) - min(timestamp)` agrupado por `session_id`

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
- [ ] Documentar limitação: hard-kill por OOM ou timeout da plataforma não pode ser capturado pelo backend

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

- [x] Testes para `service.go` — validações, regras de negócio, cálculo de sessão
- [x] Testes para `sanitizer.go` e `validator.go` — detecção e mascaramento de dados sensíveis
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

- [x] Criar script `scripts/seed.go` ou `scripts/seed.sh`
- [x] Gerar dados para múltiplos projetos e serviços
- [x] Cobrir variações de: `method`, `status_code`, `environment`, `response_time`, `user_roles`
- [x] Distribuição temporal realista — eventos espalhados nos últimos 30 dias
- [x] Incluir cenários de pico (muitos erros em um período) para testar alertas visuais
- [ ] Incluir eventos órfãos (browser sem backend) para testar a detecção de orphans

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
- [ ] Documentar no README que a API é versionada

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
- [ ] Rodar testes de integração via `docker-compose.test.yml`
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

### 12.4 Versionamento semântico

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
- [ ] Internacionalizar mensagens de erro (hoje misturadas em PT e EN)

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

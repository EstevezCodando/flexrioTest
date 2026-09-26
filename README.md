# Rio Flex

**Software de controle inteligente de recarga de veículos elétricos** que recebe sinais de preço do mercado de energia e os repassa ao consumidor, dando mais controle e flexibilidade à rede e construindo uma relação de **confiança** com quem carrega o carro.

> Estado atual: protótipo funcional (hackathon). Frontend React + API Node com banco SQLite persistente. **Os dados de preço, rede e clima são simulados (mock)**, mas todo o desenho foi feito para trocar o mock por fontes reais (CCEE, ONS, INMET). A base de **estações de recarga é real**: 828 locais / 1.422 conectores do RJ (coleta `carregados_rj`, 22/09/2026).

---

## 1. A proposta

### O problema
A rede elétrica tem horas de energia abundante e barata (por exemplo, o meio-dia com sol) e horas de pico caras e pressionadas (início da noite). O motorista de carro elétrico, hoje, não enxerga isso: paga um preço opaco e recarrega quando dá. O operador da rede, por sua vez, não tem como pedir que a demanda se desloque.

### A ideia
O Rio Flex faz a ponte entre os dois lados:

| Lado | O que recebe |
|---|---|
| **Consumidor (motorista)** | Preço claro por tipo de recarga, hora a hora; janelas verdes/amarelas/vermelhas; alertas de preço-alvo; postos compatíveis e livres; créditos ao deslocar ou reduzir a potência. |
| **Gestor (operação)** | Visão agregada por região (preço, demanda, geração, clima, ocupação dos carregadores), publicação de **sinais de preço** repassados aos consumidores e a **FlexIA**, assistente interno com acesso a regulação, protocolos, preços e dados da rede. |

### Como o sinal de preço chega ao consumidor
```
Mercado livre (PLD/CCEE, ofertas de comercializadoras)  ─┐
Rede (ONS, distribuidora) e clima (INMET)                ─┼─▶ Precificação Rio Flex ─▶ Sinal 🟢🟡🔴 + preço por tipo de recarga ─▶ Consumidor
Decisão do gestor (sinal manual, apoiada pela FlexIA)    ─┘                                                                         (app, alertas, créditos)
```

1. **Custo da energia por região e hora.** O sistema cota, a cada hora, todas as comercializadoras que atendem a região (produto convencional ou incentivada com desconto na TUSD) e escolhe a **melhor oferta**. O custo é decomposto em *energia (PLD + spread) + fio (TUSD, por posto tarifário) + encargos + tributos*.
2. **Preço ao consumidor por tipo de carregamento** = (custo da energia + margem do serviço) × multiplicador do sinal. A margem cresce com a potência: **AC lenta → AC semirrápida → DC rápida → DC ultrarrápida**.
3. **Nível do sinal.** Automático (percentis do custo do dia + posto de ponta) ou **manual pelo gestor**, que também define o bônus de crédito por kWh. Sinal verde reduz o preço e paga crédito; vermelho encarece e incentiva adiar.
4. **Flexibilidade na prática.** Durante uma recarga DC, se a região está sob pressão, o app oferece reduzir a potência (ex.: 80 → 48 kW) em troca de crédito, mantendo a meta de carga. É resposta da demanda agregada, feita com transparência e opt-in.
5. **Confiança.** O motorista vê *por que* o preço é aquele (composição do custo, comercializadora vencedora, posto tarifário), o preço fica **travado ao iniciar a sessão**, e o gestor só publica sinais explicando o benefício. Gestores veem apenas dados agregados (LGPD).

### Papéis e telas
**Motorista** (`/login`): Início (melhor posto + sinal agora) · Mapa (828 estações, filtros por tipo de recarga/disponibilidade) · **Preços** (custo, composição, curva de 24 h, melhor oferta, comparativo por região) · **Alertas** (preço-alvo e janelas verdes, notificações) · Carregar (sessão simulada + modulação) · Carteira · Perfil/veículo.

**Gestor** (`/gestor/login`): Visão geral por região · **Rede, preço & clima** (PLD, demanda vs. capacidade, geração por fonte, clima) · **Sinais de preço** (publicar/cancelar, notifica consumidores) · **FlexIA** (chat com ferramentas) · **Regulação & protocolos** (base pesquisável).

### FlexIA (agente interno)
Assistente exclusivo dos gestores, com **9 ferramentas** somente-leitura sobre os mesmos serviços da API: regiões, preço de energia, PLD, rede, clima, regulação/protocolos, resumo de estações, sinais ativos e **proposta de sinal** (que *não publica*: o gestor aprova na tela).

- Com `ANTHROPIC_API_KEY`: usa Claude (`claude-opus-5` por padrão, `FLEXIA_MODEL`) em um loop manual de ferramentas com *adaptive thinking*, prompt caching do prompt de sistema e fallback de recusa do lado do servidor.
- Sem chave (ou se a API falhar): **motor local** por intenção, que chama as mesmas ferramentas e redige a resposta — o sistema nunca fica sem a FlexIA.
- Conversas ficam persistidas por gestor. A base de conhecimento (`src/flexia/knowledge.ts`) traz resumos de ANEEL (REN 819/2018, REN 1.000/2021, Tarifa Branca, bandeiras), CCEE (PLD horário), mercado livre/energia incentivada, Lei 14.300, resposta da demanda, LGPD, OCPP, OCPI, OpenADR, ISO 15118, IEC 61851/62196 e NBR 17019. **São resumos de apoio; confirme sempre o texto oficial vigente.**

---

## 2. Arquitetura

```
artifacts/
├─ rio-flex/        Frontend: React 19 + Vite + wouter + TanStack Query + Recharts + Leaflet + PWA
└─ api-server/      API: Node 24 + Express 5 + node:sqlite + zod
   ├─ src/db/         migrações versionadas, seed (importa carregados_rj), CLI
   ├─ src/domain/     dados de referência (regiões, comercializadoras fictícias, tarifas)
   ├─ src/services/   market · pricing · signals · alerts · stations · charging · wallet · grid · auth
   ├─ src/routes/     auth · public (catálogo/preços) · consumer · manager
   ├─ src/flexia/     agent (Claude) · local-engine · tools · knowledge
   ├─ src/middleware/ segurança (sessão, CSRF, papéis, rate limit, erros)
   ├─ data/carregados_rj/  CSVs da base de estações (fonte do seed)
   └─ test/           testes de integração (node:test)
lib/api-client-react/   (legado do template; não usado pelo app atual)
```

### Banco de dados (persistente)
SQLite em `artifacts/api-server/data/rioflex.db` (WAL, `foreign_keys=ON`). Criado e populado automaticamente na primeira execução; **os dados sobrevivem a reinícios**. Tabelas principais:

| Grupo | Tabelas |
|---|---|
| Referência | `regions`, `municipalities`, `suppliers` |
| Estações (real) | `stations`, `connectors`, `station_quality` |
| Mercado | `market_prices` (PLD horário por submercado) |
| Sinais e alertas | `price_signals`, `price_alerts`, `notifications` |
| Uso | `charging_sessions`, `wallet_ledger` (livro-razão em centavos) |
| Contas | `users`, `auth_sessions` |
| FlexIA e auditoria | `flexia_conversations`, `flexia_messages`, `audit_log` |

Migrações ficam em `src/db/index.ts` (`MIGRATIONS`) — para evoluir o schema, **acrescente** uma migração nova; nunca edite as antigas. Para zerar e repopular: `pnpm db:reset`.

### Dados reais x simulados
| Dado | Origem hoje | Integração futura |
|---|---|---|
| Estações, conectores, potência, preço publicado | **Real** (carregados_rj, snapshot 22/09/2026) | atualizar snapshot / OCPI |
| PLD horário | Mock (`MockMarketProvider`) | **CCEE** — implementar `MarketDataProvider` |
| Ofertas do mercado livre | 5 comercializadoras **fictícias** | ofertas reais por região |
| Demanda regional, geração por fonte | Mock (`services/grid.ts`) | **ONS** + distribuidora |
| Clima | Mock | **INMET** / modelos numéricos |
| Disponibilidade dos conectores | Simulada (determinística por janela de 10 min) | OCPP/OCPI em tempo real |

A integração com o mercado livre é isolada em `MarketDataProvider` (`src/services/market.ts`): basta um provedor real que retorne `PldPoint[]` e trocá-lo em `activeProvider`. O restante (ofertas, melhor preço por região, sinais, alertas, FlexIA) não muda.

**Base carregados_rj (avisos herdados da fonte):** não é censo nem verificação de operação real; preço publicado ≠ cotação executável; 551 de 828 locais não têm preço; há conflitos entre descrição e preço (`priceConflict`). Esses casos aparecem sinalizados na UI. Os preços exibidos ao consumidor vêm do modelo Rio Flex; o preço publicado é mostrado como referência.

---

## 3. Segurança

- **Autenticação**: senhas com **scrypt** + sal; sessão por **token opaco** em cookie **httpOnly + SameSite=Strict** (só o hash SHA-256 é guardado); expiração configurável; sessões antigas limpas no login.
- **Dois portais**: o papel é validado no login (`portal`) — gestor não entra pelo portal do motorista e vice-versa; resposta de erro genérica e tempo equalizado com hash fantasma (sem enumeração de e-mails). Bloqueio de 15 min após 5 falhas; contas de gestor **não têm auto-cadastro**.
- **Autorização** por papel em todas as rotas (`/me/*` só consumidor, `/manager/*` só gestor); consumidores só acessam os próprios recursos (checagem `user_id` nas queries).
- **CSRF**: cookie SameSite=Strict + cabeçalho obrigatório `X-Requested-With: RioFlex` + verificação de `Origin`.
- **Entrada**: validação com **zod** em todas as rotas (IDs, faixas numéricas, tamanhos); SQL somente com *prepared statements*; corpo JSON limitado a 32 kB.
- **Hardening**: `helmet` (CSP restritiva), `compression`, **rate limit** global, no login e na FlexIA; `Cache-Control: no-store` por padrão; erros internos não vazam detalhes.
- **Privacidade (LGPD)**: gestores só veem dados agregados; log de auditoria de login, sinais e recargas; renderização de markdown da FlexIA **sem `innerHTML`**.
- **FlexIA**: ferramentas somente-leitura; a única que "escreve" apenas *propõe* e exige aprovação humana; entrada validada por schema antes de executar.
- **Em produção**: defina `NODE_ENV=production`, `COOKIE_SECURE=true`, `ALLOWED_ORIGINS`, use HTTPS/proxy confiável e **troque as senhas de demonstração** (o seed só cria contas demo — nunca as use fora do ambiente local).

---

## 4. Como rodar

Pré-requisitos: **Node 24+** (usa `node:sqlite`) e **pnpm 10**.

```bash
pnpm install
```

Em dois terminais:

```bash
pnpm dev:api      # API em http://localhost:5000  (cria e popula o banco na 1ª vez)
pnpm dev:web      # Frontend em http://localhost:5173 (proxy /api → :5000)
```

Abra `http://localhost:5173`. Sem `pnpm` instalado: `npx pnpm@10 <comando>`.

Outros comandos:

```bash
pnpm typecheck                              # frontend + API
pnpm --filter @workspace/api-server test    # testes de integração da API
pnpm db:reset                               # limpa e repopula o banco
pnpm build                                  # build de produção do frontend
```

Configuração da API: copie `artifacts/api-server/.env.example` para `.env`. Variáveis: `PORT`, `DB_PATH`, `ALLOWED_ORIGINS`, `SESSION_TTL_HOURS`, `COOKIE_SECURE`, `CHARGING_SIM_SPEED` (aceleração da simulação de recarga), `ANTHROPIC_API_KEY`/`FLEXIA_MODEL` e as credenciais do seed.

### Contas de demonstração (somente ambiente local)
Criadas pelo seed em banco vazio; valores em `.env.example` (`SEED_*`):

| Portal | E-mail | Senha |
|---|---|---|
| Motorista (`/login`) | `marcos@rioflex.dev` | `RioFlex@2026` |
| Gestor (`/gestor/login`) | `gestora@rioflex.dev` | `Gestor@2026` |

O cadastro de novos motoristas está em `/signup`.

### Roteiro de demonstração (5 min)
1. **Gestor** → *Rede, preço & clima*: veja o vale de PLD ao meio-dia e o pico à noite.
2. **Gestor** → *FlexIA*: “Proponha um sinal de preço para a Região dos Lagos avisando os consumidores” → **Publicar sinal**.
3. **Motorista** → *Preços*: o sinal verde aparece, o preço DC cai; em *Alertas* chega a notificação.
4. **Motorista** → *Mapa* → estação → **Iniciar** → aceitar a **modulação** → concluir → ver recibo e crédito na *Carteira*.

---

## 5. API (resumo)
Prefixo `/api/v1`; JSON; cookie de sessão; `X-Requested-With: RioFlex` em métodos de escrita.

| Rota | Papel | Descrição |
|---|---|---|
| `POST /auth/login` `{email,password,portal}` · `POST /auth/register` · `POST /auth/logout` · `GET/PATCH /auth/me` | — | Sessão |
| `GET /meta` | público | Tipos de recarga, níveis, regiões, estatísticas da base |
| `GET /stations` `?region&chargeType&available&public&operational&maxPrice&lat&lng&radiusKm&sort&q` · `/stations/markers` · `/stations/:id` | logado | Estações com preço por tipo, score e disponibilidade |
| `GET /prices` · `/prices/:region/now` · `/prices/:region/forecast` · `/market/pld` · `/signals` | logado | Preço, composição, melhor oferta, janelas, PLD |
| `/me/alerts` (CRUD) · `/me/charging` (`POST`, `/active`, `/history`, `/:id`, `/:id/flex`, `/:id/stop`) · `/me/wallet` | motorista | Alertas, recarga, carteira |
| `/notifications` (`GET`, `POST /read-all`, `POST /:id/read`) | logado | Notificações |
| `/manager/overview` · `/grid/:region` · `/signals` (`GET/POST/DELETE`) · `/knowledge` · `/audit` | gestor | Operação |
| `/manager/flexia/{status,conversations,chat}` | gestor | FlexIA |

---

## 6. Limitações e próximos passos
- Preço, rede e clima são simulados; a tarifa do mock **não é homologada** nem cotação real. Comercializadoras são fictícias.
- Disponibilidade e sessões de recarga são simuladas; cobrança/pagamento não existem. Nenhum carregador é comandado de fato.
- Faltam: integração CCEE/ONS/INMET, OCPP/OCPI para controlar/ler carregadores, provedor de pagamento, notificações push (hoje as notificações são in-app), e-mail/SMS, fila de jobs dedicada, observabilidade e testes de interface.
- Abertura do mercado livre para baixa tensão: verifique o marco regulatório vigente antes de qualquer oferta comercial.
- V2G e geração solar própria (visão futura do projeto) ainda não implementados.
- O SQLite atende o protótipo; para múltiplas instâncias migre para PostgreSQL mantendo o desenho de migrações.
- O `lib/api-client-react`, o `replit.md` e os scripts de deploy vieram do template original e não são usados pelo fluxo atual.

Histórico do projeto original: `JORNADA_DO_USUARIO.md` (redesenho da jornada) e `RIO_FLEX_LOVABLE_MASTER_PROMPT.md` (prompt de origem).

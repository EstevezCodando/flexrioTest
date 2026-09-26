# Rio Flex — Lovable Master Prompt
## Frontend piloto para Hackathon de Transição Energética — COPPE/UFRJ

> **Objetivo deste arquivo:** servir como prompt mestre para gerar, no Lovable, um frontend piloto navegável do **Rio Flex**, com foco na jornada de mobilidade elétrica e recomendação inteligente de pontos de recarga.
>
> O protótipo deve parecer um produto real, pronto para demonstração em hackathon, sem exigir integrações reais no primeiro momento. Todos os dados podem ser mockados, mas a experiência deve comunicar claramente a lógica do produto.

---

# 1. Contexto do produto

O **Rio Flex** é uma plataforma de coordenação de flexibilidade energética concebida como uma **Virtual Power Plant (VPP) modular**.

A arquitetura de longo prazo deve permitir a integração de múltiplos tipos de ativos:

- veículos elétricos;
- carregadores;
- geração fotovoltaica;
- baterias estacionárias;
- climatização e edifícios;
- cargas industriais;
- outros Distributed Energy Resources (DERs).

Entretanto, o **MVP demonstrável do hackathon deve focar em mobilidade elétrica**, usando a recarga de veículos como primeiro caso de uso.

O frontend não deve tentar comunicar toda a complexidade de uma VPP para o usuário comum.

Para o usuário final, a proposta de valor é simples:

> **Encontrar o melhor lugar e o melhor momento para carregar um veículo elétrico, considerando preço, distância, disponibilidade, potência, tempo, compatibilidade e incentivos.**

A camada de inteligência do produto deve aparecer por meio de recomendações, comparações, planejamento e monitoramento.

---

# 2. Tese do piloto

O piloto deve demonstrar que o Rio Flex consegue:

1. identificar o contexto do usuário;
2. entender o veículo;
3. localizar pontos de recarga;
4. comparar os pontos disponíveis;
5. recomendar a melhor opção;
6. justificar a recomendação;
7. permitir o planejamento da recarga;
8. acompanhar uma sessão;
9. apresentar economia e impacto;
10. criar incentivos para deslocar a carga para horários ou locais mais adequados.

A ideia não é criar apenas um “mapa de eletropostos”.

O diferencial deve estar na camada de decisão.

O mapa é uma interface para visualizar a infraestrutura.

A inteligência está na resposta:

> **“Onde e quando faz mais sentido carregar?”**

---

# 3. Escopo do frontend piloto

Construir uma aplicação web responsiva, moderna e navegável.

O protótipo deve incluir:

- landing page;
- login e cadastro;
- onboarding do veículo;
- dashboard;
- recomendação inteligente;
- mapa de pontos de recarga;
- filtros;
- detalhe de um ponto;
- planejamento de recarga;
- sessão de carregamento;
- histórico;
- monitoramento;
- recompensas e incentivos;
- perfil do usuário;
- visão futura de ativos energéticos.

Não implementar backend real.

Não implementar pagamentos reais.

Não implementar OCPP real.

Não implementar conexão real com distribuidora, ONS ou carregadores.

Todas as informações devem ser apresentadas com dados simulados coerentes.

---

# 4. Personas principais

## 4.1 Motorista de veículo elétrico

Usuário principal do MVP.

Objetivos:

- encontrar onde carregar;
- pagar menos;
- evitar fila;
- reduzir tempo perdido;
- saber quanto a recarga vai custar;
- planejar o momento da recarga;
- receber recomendações úteis;
- acompanhar a sessão;
- visualizar histórico e economia.

---

## 4.2 Prosumidor / dono de ativo energético

Persona secundária, apenas para demonstrar a visão futura da plataforma.

Pode possuir:

- painel fotovoltaico;
- bateria;
- carregador bidirecional;
- veículo com V2G.

Essa persona não deve competir visualmente com a jornada principal.

A interface pode mostrar:

> “Recursos energéticos — em breve”

com cards de:

- Solar;
- Bateria;
- V2G.

---

# 5. Posicionamento de produto

Evitar linguagem excessivamente técnica na experiência do usuário.

Não usar na interface principal expressões como:

- despacho energético;
- DER aggregation;
- resposta da demanda;
- envelope de flexibilidade;
- settlement;
- VPP orchestration.

Esses conceitos podem aparecer apenas em áreas institucionais ou demonstrações técnicas.

Para o usuário, usar linguagem como:

- Melhor opção agora
- Economize na próxima recarga
- Carregue no melhor horário
- Pontos próximos
- Menor preço
- Sem fila
- Mais rápido
- Recompensas
- Economia acumulada
- Recarga inteligente

---

# 6. Jornada principal

A principal jornada deve ser:

```text
Landing
  ↓
Login / Cadastro
  ↓
Onboarding do veículo
  ↓
Dashboard
  ↓
Melhor recarga agora
  ↓
Mapa + recomendações
  ↓
Detalhe do ponto
  ↓
Planejar ou iniciar rota
  ↓
Sessão de recarga
  ↓
Resumo da sessão
  ↓
Histórico / monitoramento / recompensas
```

---

# 7. Arquitetura de navegação

Usar sidebar no desktop e bottom navigation no mobile.

## Navegação principal

- Início
- Mapa
- Planejar
- Monitoramento
- Recompensas
- Histórico
- Perfil

Separar “Recursos energéticos” como seção secundária:

- Mobilidade — ativo
- Solar — em breve
- Baterias — em breve
- V2G — em breve

---

# 8. Landing page

A landing deve ser elegante e curta.

## Hero

Headline:

> **Carregue melhor. Pague menos. Ajude a equilibrar a energia da cidade.**

Subheadline:

> O Rio Flex encontra os melhores pontos e horários para recarregar seu veículo elétrico usando preço, disponibilidade, distância e condições da rede.

CTAs:

- `Encontrar melhor recarga`
- `Conhecer o Rio Flex`

Criar uma visualização hero com:

- mapa simplificado;
- pontos de recarga;
- card flutuante de recomendação;
- preço por kWh;
- economia estimada;
- status “sem fila”.

Exemplo:

```text
Melhor opção agora
Estação Porto Maravilha

R$ 1,19/kWh
2,4 km
150 kW
Sem fila

Economia estimada: R$ 11,40
```

## Seção “Como funciona”

Três etapas:

1. Informe seu veículo e objetivo.
2. O Rio Flex compara preço, distância e disponibilidade.
3. Você escolhe a melhor recarga e acompanha tudo pelo app.

## Seção de benefício

Cards:

- Menor custo
- Menor espera
- Planejamento inteligente
- Incentivos por flexibilidade

## Visão futura

Uma pequena seção:

> Uma plataforma preparada para integrar mobilidade, baterias, solar e outros recursos energéticos.

Não transformar essa seção no foco da landing.

---

# 9. Login e cadastro

Criar telas simples.

## Login

Campos:

- e-mail
- senha

Ações:

- Entrar
- Continuar com Google
- Criar conta
- Esqueci minha senha

## Cadastro

Campos:

- nome;
- e-mail;
- telefone;
- senha.

Após cadastro, redirecionar para onboarding do veículo.

---

# 10. Onboarding do veículo

Criar onboarding em 3 etapas.

## Etapa 1 — Veículo

Campos:

- fabricante;
- modelo;
- ano;
- versão.

Exemplo mock:

```text
BYD Dolphin GS
2026
```

## Etapa 2 — Bateria

Dados preenchidos automaticamente após seleção do modelo, mas editáveis:

- capacidade da bateria;
- autonomia média;
- potência máxima AC;
- potência máxima DC;
- tipo de conector.

Exemplo:

```text
Capacidade: 44,9 kWh
Conector: CCS2
DC máximo: 80 kW
```

## Etapa 3 — Preferências

Pergunta:

> O que você mais valoriza ao carregar?

Permitir ordenar ou selecionar:

- menor preço;
- menor distância;
- menor tempo;
- menor fila;
- energia renovável.

Default:

```text
1. Menor preço
2. Menor tempo
3. Menor distância
```

CTA:

`Começar`

---

# 11. Dashboard principal

O dashboard deve imediatamente responder:

> **Qual é a melhor decisão para esse usuário agora?**

Não começar com gráficos.

Começar com uma recomendação.

---

## 11.1 Cabeçalho

Exemplo:

```text
Boa tarde, Marcos
Seu veículo está com 32%
```

Mostrar avatar e notificações.

---

## 11.2 Card principal — Melhor opção agora

Este é o elemento mais importante da home.

Exemplo:

```text
Melhor opção para você agora

Estação Marina da Glória
R$ 1,15/kWh
3,2 km
120 kW
Disponível agora

Chegada: 14 min
Recarga estimada: 27 min
Custo até 80%: R$ 24,80

Você economiza R$ 9,60 em relação à média próxima.

[Ver rota] [Ver detalhes]
```

Adicionar um pequeno selo:

`Recomendado pelo Rio Flex`

---

## 11.3 Card “Vale a pena esperar?”

Exemplo:

```text
Se você puder esperar até 14:30

o preço estimado cai 18%

Economia adicional:
R$ 5,30
```

CTA:

`Planejar para 14:30`

Essa funcionalidade é central para transmitir flexibilidade energética.

---

## 11.4 Resumo rápido

Cards:

```text
Economia este mês
R$ 84,30

Energia carregada
126 kWh

Recargas inteligentes
7

Créditos Rio Flex
R$ 18,40
```

---

## 11.5 Mini mapa

Mostrar 4–6 pontos próximos.

Botão:

`Abrir mapa completo`

---

# 12. Tela de mapa

O mapa deve ser uma das telas mais fortes visualmente.

Usar um mapa escuro ou neutro, integrado ao design.

Mostrar pins diferenciados por status.

## Pins

Estados:

- verde: disponível e recomendado;
- azul: disponível;
- amarelo: alta ocupação;
- vermelho: indisponível;
- roxo: incentivo ativo.

Não depender apenas de cor; adicionar ícones/labels.

---

# 13. Painel lateral do mapa

No desktop, usar mapa à esquerda e painel à direita.

No mobile, usar mapa e bottom sheet.

O painel deve listar recomendações.

Exemplo:

```text
1. Marina da Glória
R$ 1,15/kWh
3,2 km
120 kW
0 min de fila
Score 94

2. Shopping RioSul
R$ 1,22/kWh
5,1 km
150 kW
5 min de fila
Score 88

3. Botafogo Praia Shopping
R$ 1,31/kWh
4,7 km
60 kW
Disponível
Score 80
```

---

# 14. Filtros do mapa

Permitir filtrar por:

- preço máximo;
- distância;
- potência;
- conector;
- disponibilidade;
- operador;
- energia renovável;
- incentivo ativo.

Ordenações:

- Melhor escolha
- Mais barato
- Mais perto
- Mais rápido
- Menor fila

---

# 15. Camadas do mapa

Criar selector de camada:

- Pontos
- Preço
- Disponibilidade
- Incentivos

Para o piloto, o heatmap pode ser simulado.

## Camada preço

Mostrar regiões em gradiente de preço relativo.

Tooltip:

```text
Preço médio nesta região:
R$ 1,21/kWh
```

## Camada disponibilidade

Mostrar áreas ou pontos com:

- baixa ocupação;
- média;
- alta.

## Camada incentivos

Destacar pontos que oferecem crédito.

---

# 16. Detalhe de ponto de recarga

Criar página ou drawer detalhado.

Exemplo:

```text
Estação Marina da Glória

Disponível agora
3,2 km · 14 min

Preço
R$ 1,15/kWh

Potência
120 kW

Conectores
2x CCS2
1x Type 2

Ocupação
1 de 4 em uso

Avaliação
4,8
```

---

## 16.1 Cálculo para o usuário

Mostrar:

```text
Seu carro: 32%
Meta: 80%

Energia necessária
21,6 kWh

Tempo estimado
27 min

Custo estimado
R$ 24,80
```

---

## 16.2 Justificativa da recomendação

Criar seção:

### Por que recomendamos este ponto?

```text
✓ 12% mais barato que a média próxima
✓ sem fila neste momento
✓ compatível com seu veículo
✓ rota com apenas 3,2 km
✓ incentivo de R$ 3,00 ativo
```

Essa seção deve ser visualmente importante.

---

## 16.3 Ações

Botões:

- `Iniciar rota`
- `Planejar recarga`

Secundário:

- `Salvar ponto`

---

# 17. Planejador de recarga

Criar tela específica.

Headline:

> Quando você precisa do carro pronto?

Inputs:

- carga atual;
- carga desejada;
- horário limite;
- localização atual;
- destino opcional.

Exemplo:

```text
Carga atual: 32%
Quero chegar em: 80%
Preciso sair às: 18:00
```

Após clicar em:

`Encontrar melhor plano`

mostrar resultado.

---

# 18. Resultado do planejamento

Exemplo:

```text
Plano recomendado

14:20
Saia de casa

14:36
Chegada à estação

14:40
Início da recarga

15:07
80% de bateria

Custo estimado
R$ 24,80

Economia
R$ 7,40
```

Adicionar alternativa:

```text
Mais conveniente
R$ 27,10

Mais barato
R$ 23,50

Mais rápido
R$ 29,30
```

---

# 19. Sessão de recarga

Criar uma tela de sessão ativa.

Visual principal:

- círculo ou progress bar com estado da bateria.

Exemplo:

```text
62%

Meta: 80%
```

Dados:

```text
Energia adicionada
13,4 kWh

Tempo
18 min

Restante
9 min

Custo atual
R$ 15,41

Custo estimado final
R$ 24,80
```

Mostrar curva simples de potência.

Botão:

`Encerrar recarga`

---

# 20. Resumo pós-recarga

Após finalizar:

```text
Recarga concluída

32% → 80%

21,7 kWh
27 min
R$ 24,92
```

Mostrar:

```text
Você economizou
R$ 8,70

Crédito recebido
R$ 3,00
```

CTA:

- Avaliar estação
- Ver histórico
- Voltar ao início

---

# 21. Monitoramento

A tela de monitoramento deve mostrar valor para o usuário sem parecer um painel técnico.

Período:

- semana;
- mês;
- ano.

KPIs:

- energia consumida;
- gasto;
- economia;
- preço médio por kWh;
- número de recargas;
- recargas inteligentes.

Gráficos:

1. gasto ao longo do tempo;
2. energia carregada;
3. preço médio pago vs média da região.

Exemplo:

```text
Seu preço médio
R$ 1,18/kWh

Média próxima
R$ 1,34/kWh

Economia
12%
```

---

# 22. Recompensas e incentivos

Criar uma área específica.

Headline:

> Ganhe ao carregar com flexibilidade.

Mostrar saldo:

```text
Créditos disponíveis
R$ 18,40
```

Campanhas ativas:

### Carregue fora do pico

```text
Carregue entre 13h e 16h

+ R$ 4,00 de crédito
```

### Use um ponto recomendado

```text
Estação Cidade Nova

+ 8% de cashback
```

### Recarga programada

```text
Permita que o Rio Flex escolha
o melhor momento dentro da sua janela

+ R$ 3,50
```

---

# 23. Histórico

Lista de recargas.

Cada item:

```text
12 set 2026

Marina da Glória

21,7 kWh
R$ 24,92
27 min

Economia: R$ 8,70
```

Filtros:

- período;
- local;
- custo;
- quantidade de energia.

---

# 24. Perfil

Mostrar:

## Dados pessoais

- nome;
- e-mail;
- telefone.

## Meu veículo

- modelo;
- bateria;
- conector;
- preferências.

## Preferências de recomendação

Slider ou ranking:

- preço;
- distância;
- tempo;
- fila;
- sustentabilidade.

## Pagamento

Mock apenas.

---

# 25. Recursos energéticos

Criar uma área secundária chamada:

> Meus recursos energéticos

Cards:

### Mobilidade

Status:

`Ativo`

Mostrar o veículo.

### Solar

`Em breve`

Texto:

> Conecte sua geração fotovoltaica ao Rio Flex.

### Bateria

`Em breve`

Texto:

> Use armazenamento para otimizar consumo e flexibilidade.

### V2G

`Em breve`

Texto:

> No futuro, veículos compatíveis poderão fornecer energia de volta à rede ou à instalação.

Não implementar fluxo real de venda no MVP.

---

# 26. Sistema de recomendação — explicação visual

O frontend deve dar a sensação de que existe uma camada inteligente por trás da decisão.

Criar um “Rio Flex Score” de 0 a 100.

Exemplo:

```text
Rio Flex Score
94 / 100
```

Com breakdown:

```text
Preço          98
Distância      87
Disponibilidade 100
Velocidade     92
Incentivo      90
```

Evitar parecer gamificação vazia.

Esse score representa a adequação daquele ponto ao contexto do usuário.

---

# 27. Dados mockados

Criar pelo menos 12 pontos de recarga no Rio de Janeiro.

Exemplos:

- Marina da Glória
- Botafogo
- Flamengo
- Copacabana
- Ipanema
- Leblon
- Centro
- Cidade Nova
- Barra da Tijuca
- Recreio
- Tijuca
- São Cristóvão

Não é necessário representar operadores reais.

Usar nomes fictícios como:

- RioCharge
- VoltWay
- Carioca EV
- PlugRio
- FlexPoint

---

# 28. Estrutura de dados sugerida

## ChargingStation

```ts
type ChargingStation = {
  id: string
  name: string
  operator: string

  address: string

  latitude: number
  longitude: number

  distanceKm: number
  etaMinutes: number

  pricePerKwh: number

  availableConnectors: number
  totalConnectors: number

  connectors: Array<{
    type: "CCS2" | "Type2" | "CHAdeMO"
    powerKw: number
    available: boolean
  }>

  renewableShare: number

  estimatedQueueMinutes: number

  incentive?: {
    label: string
    value: number
  }

  score: number
}
```

---

## Vehicle

```ts
type Vehicle = {
  manufacturer: string
  model: string
  batteryCapacityKwh: number
  currentSoc: number
  targetSoc: number

  connector: string

  maxAcPowerKw: number
  maxDcPowerKw: number
}
```

---

## ChargingSession

```ts
type ChargingSession = {
  stationId: string

  startedAt: string

  initialSoc: number
  currentSoc: number
  targetSoc: number

  energyDeliveredKwh: number

  currentCost: number

  estimatedFinalCost: number

  elapsedMinutes: number
  remainingMinutes: number
}
```

---

# 29. Estados importantes

Toda tela deve ter estados de:

- loading;
- empty;
- success;
- error.

Exemplo:

### Nenhum ponto encontrado

```text
Nenhum ponto compatível foi encontrado nesta área.

Tente aumentar o raio de busca ou alterar os filtros.
```

---

# 30. Design system

O visual deve transmitir:

- tecnologia;
- infraestrutura;
- energia;
- inteligência;
- mobilidade;
- confiabilidade.

Não criar visual de “startup ecológica genérica”.

Evitar excesso de:

- folhas;
- árvores;
- ícones de planeta;
- verde neon em tudo.

A sustentabilidade deve ser percebida pelo produto, não por clichês gráficos.

---

# 31. Direção visual

Referências de sensação visual:

- fintech moderna;
- plataforma de infraestrutura;
- mobility tech;
- energy management;
- dashboard de produto premium.

A interface deve ser:

- limpa;
- escura ou dark-first;
- técnica sem ser intimidadora;
- elegante;
- com alto contraste;
- com mapas e dados como elementos centrais.

---

# 32. Tema principal

Criar tema **dark-first**.

Background principal:

```css
#0B0E11
```

Surfaces:

```css
#11161B
#151B21
#1B222A
```

Borders:

```css
#27313A
```

Texto principal:

```css
#F4F7F9
```

Texto secundário:

```css
#98A6B3
```

Texto muted:

```css
#66727E
```

---

# 33. Cores de marca

Cor primária:

```css
#4AE3A5
```

Uso:

- CTAs;
- status positivos;
- recomendação;
- elementos inteligentes.

Cor secundária:

```css
#55A7FF
```

Uso:

- informação;
- mapa;
- navegação;
- gráficos.

Accent:

```css
#B98CFF
```

Uso:

- incentivos;
- recompensa;
- programas de flexibilidade.

Warning:

```css
#F7C65C
```

Danger:

```css
#FF6B6B
```

---

# 34. Gradientes

Usar de forma discreta.

Exemplo:

```css
linear-gradient(
  135deg,
  #4AE3A5 0%,
  #55A7FF 100%
)
```

Apenas para:

- hero;
- bordas selecionadas;
- indicadores premium;
- visualização de inteligência.

Não aplicar gradiente em todos os cards.

---

# 35. Tipografia

Preferir:

- Inter
- Geist
- Manrope

Recomendação principal:

```text
Geist
```

Hierarchy:

```text
Display: 48–64px
H1: 36–44px
H2: 28–32px
H3: 20–24px
Body: 15–17px
Small: 13px
Caption: 11–12px
```

Pesos:

- 400
- 500
- 600
- 700

Evitar 800/900 excessivamente.

---

# 36. Grid e spacing

Base:

```text
4px
```

Escala:

```text
4
8
12
16
20
24
32
40
48
64
80
```

Cards:

```text
padding: 20–24px
```

---

# 37. Border radius

Usar cantos modernos sem exagero.

```text
sm: 8px
md: 12px
lg: 16px
xl: 22px
```

Cards principais:

```text
16px
```

Botões:

```text
10–12px
```

---

# 38. Sombras

Dark UI com sombras sutis.

Exemplo:

```css
0 12px 40px rgba(0,0,0,0.28)
```

Não usar sombras muito fortes em todos os elementos.

---

# 39. Buttons

## Primary

Background:

```text
#4AE3A5
```

Text:

```text
#07110D
```

Hover:

ligeiramente mais claro.

## Secondary

Dark surface + border.

## Ghost

Transparente.

## Danger

Somente para ações destrutivas.

---

# 40. Cards

Criar padrões reutilizáveis:

- KPI card;
- recommendation card;
- station card;
- incentive card;
- session card;
- vehicle card.

O recommendation card deve ser o mais visualmente importante.

---

# 41. Badges

Exemplos:

```text
Recomendado
Disponível
Sem fila
Mais barato
Incentivo ativo
120 kW
CCS2
```

Badges pequenos, discretos e bem contrastados.

---

# 42. Ícones

Usar Lucide Icons.

Sugestões:

- MapPin
- Zap
- BatteryCharging
- Clock
- Navigation
- Wallet
- Gauge
- Leaf
- Gift
- History
- Car
- Sun
- Battery
- Activity
- TrendingDown

---

# 43. Charts

Usar Recharts.

Gráficos simples.

Nunca deixar gráfico sem:

- unidade;
- tooltip;
- label;
- contexto.

---

# 44. Mapa

Preferência:

- Mapbox;
- Leaflet;
- OpenStreetMap.

Se a integração não estiver disponível no ambiente, criar um mapa estilizado estático com pins interativos mockados.

O protótipo deve continuar visualmente funcional mesmo sem token de API.

---

# 45. Responsividade

## Desktop

Sidebar fixa.

Mapa + painel lateral.

Dashboard em grid.

## Tablet

Sidebar compacta.

## Mobile

Bottom navigation.

Mapa full screen.

Cards em bottom sheet.

O fluxo principal deve funcionar confortavelmente no celular.

---

# 46. Acessibilidade

Garantir:

- contraste WCAG AA;
- labels em inputs;
- estados de foco;
- navegação por teclado;
- não usar apenas cor para status;
- targets de toque de pelo menos 44px.

---

# 47. Microinterações

Usar animações curtas.

Exemplos:

- pin selecionado cresce levemente;
- recommendation card aparece com fade/slide;
- progresso da bateria anima;
- valores de economia fazem count-up;
- bottom sheet desliza suavemente.

Duração:

```text
150–250ms
```

Evitar animações decorativas excessivas.

---

# 48. Tom de voz

O produto deve falar de forma:

- objetiva;
- clara;
- inteligente;
- confiável.

Exemplo bom:

> Você economiza R$ 8,70 escolhendo este ponto.

Evitar:

> Estamos revolucionando o futuro sustentável da energia!

---

# 49. Dados de demonstração

Usar cenário principal:

```text
Usuário:
Marcos

Veículo:
BYD Dolphin GS

Bateria:
44,9 kWh

SOC:
32%

Meta:
80%
```

Criar uma estação recomendada:

```text
Marina Flex Station

Preço:
R$ 1,15/kWh

Distância:
3,2 km

Potência:
120 kW

Fila:
0 min

Score:
94

Economia:
R$ 9,60
```

---

# 50. Cenário de demo para apresentação

O protótipo deve permitir esta narrativa:

### Passo 1

Abrir dashboard.

Mostrar:

> “Melhor opção agora”

### Passo 2

Abrir o mapa.

Mostrar diferentes preços e disponibilidades.

### Passo 3

Selecionar uma estação.

Explicar por que ela foi recomendada.

### Passo 4

Mostrar que esperar 40 minutos reduz o preço.

### Passo 5

Planejar a recarga.

### Passo 6

Simular sessão.

### Passo 7

Finalizar e mostrar economia.

### Passo 8

Mostrar monitoramento e recompensas.

### Passo 9

Abrir “Recursos energéticos” e mostrar que a arquitetura poderá futuramente integrar solar, baterias e V2G.

---

# 51. O que não fazer

Não criar:

- marketplace P2P de energia completo;
- trading de energia;
- fluxo de compra/venda financeira;
- blockchain;
- token;
- exchange;
- painel institucional complexo;
- dashboard de operador do sistema;
- visual extremamente técnico;
- formulário regulatório.

Este frontend representa principalmente a experiência do consumidor final.

---

# 52. Requisitos técnicos para o projeto

Criar usando:

```text
React
TypeScript
Tailwind CSS
shadcn/ui
Lucide Icons
Recharts
```

Arquitetura de componentes limpa.

Criar dados mockados em arquivos separados.

Sugestão:

```text
/src
  /components
  /pages
  /data
  /types
  /hooks
  /lib
```

---

# 53. Rotas sugeridas

```text
/
/login
/signup
/onboarding

/app
/app/map
/app/planner
/app/stations/:id
/app/session
/app/history
/app/monitoring
/app/rewards
/app/assets
/app/profile
```

---

# 54. Componentes principais

Criar componentes reutilizáveis:

```text
AppSidebar
MobileBottomNavigation

RecommendationCard
StationCard
StationMap
StationMarker

FilterBar
MapLayerSelector

VehicleStatus
BatteryProgress

PlanningForm
PlanningResult

ChargingSessionCard

KpiCard
MonitoringChart

RewardCard

RioFlexScore

PageHeader
EmptyState
LoadingState
```

---

# 55. Hierarquia visual

A ordem de importância deve ser:

1. decisão recomendada;
2. custo;
3. disponibilidade;
4. tempo;
5. distância;
6. contexto energético;
7. métricas secundárias.

Não construir o dashboard como uma coleção de 12 cards de igual importância.

---

# 56. Mensagem central do produto

Toda a aplicação deve comunicar esta ideia:

> **Rio Flex transforma dados de preço, localização, disponibilidade e flexibilidade em uma decisão simples para o usuário.**

Não estamos apenas mostrando informação.

Estamos recomendando uma ação.

---

# 57. Critérios de aceite do frontend

O frontend está pronto quando:

- existe uma jornada completa do login à recarga;
- o usuário consegue visualizar um veículo;
- o dashboard mostra uma recomendação;
- existem múltiplos pontos no mapa;
- é possível filtrar e ordenar;
- um ponto pode ser aberto em detalhe;
- a recomendação possui justificativa;
- existe planejamento de recarga;
- existe uma sessão simulada;
- existe resumo pós-recarga;
- existe monitoramento;
- existem incentivos;
- existem histórico e perfil;
- o design é responsivo;
- mobile funciona bem;
- o produto parece real durante uma apresentação.

---

# 58. Prioridade de implementação

Se não for possível construir tudo de uma vez, seguir esta ordem.

## P0 — obrigatório

1. layout geral;
2. dashboard;
3. recomendação;
4. mapa;
5. detalhe da estação;
6. planejador;
7. sessão de recarga.

## P1

8. monitoramento;
9. histórico;
10. recompensas.

## P2

11. onboarding;
12. perfil;
13. ativos futuros;
14. landing page completa.

---

# 59. Instrução final ao Lovable

Crie o projeto completo seguindo este documento.

Não entregue apenas wireframes.

Construa uma interface visualmente refinada, navegável e consistente.

Priorize uma experiência que pareça um produto real de energy-tech/mobility-tech.

O foco da demonstração deve ser:

> **uma pessoa com veículo elétrico abrindo o Rio Flex e descobrindo, em poucos segundos, onde e quando deveria carregar.**

A inteligência da plataforma deve ser percebida pela recomendação, pelas comparações e pelas justificativas.

Use dados mockados realistas.

Mantenha toda a experiência em **português do Brasil**.

O produto deve estar visualmente pronto para ser apresentado a:

- banca de hackathon;
- empresas do setor energético;
- potenciais parceiros;
- potenciais investidores;
- operadores de infraestrutura de recarga.

---

# 60. Resultado esperado

Ao abrir o projeto, a impressão deve ser:

> “Isso já parece um produto utilizável — não apenas uma ideia de hackathon.”

O frontend deve comunicar, visualmente, a evolução:

```text
dados
  ↓
análise
  ↓
recomendação
  ↓
ação
  ↓
economia
  ↓
flexibilidade energética
```

Esse é o núcleo da experiência Rio Flex.

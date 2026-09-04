# Saymon Logistics

Plataforma central de operações logísticas: pedidos, estoque, ondas de
separação, expedição, alertas operacionais e métricas — em tempo real.

## Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS,
  TanStack Query, React Hook Form + Zod, Recharts, Socket.IO client.
- **Backend**: NestJS, TypeScript, Prisma, Socket.IO (WebSocket gateway),
  JWT em cookie httpOnly, `@nestjs/schedule` para detecção automática de
  alertas.
- **Banco**: PostgreSQL 16.
- **Infra**: Docker Compose, GitHub Actions.

## Rodando com Docker (recomendado)

```bash
cp .env.example .env
docker compose up -d --build
```

- Web: http://localhost:3000
- API: http://localhost:3001/api (docs Swagger em `/api/docs`)
- Login de demonstração: **admin@admin.com** / **adminroot**

O container da API roda as migrations (`prisma migrate deploy`) e, com
`SEED_ON_START=true` (padrão), popula o banco com esse usuário admin,
produtos, transportadoras e um histórico de pedidos em vários estágios do
fluxo — o suficiente para o dashboard, alertas e ranking de transportadoras
já nascerem com dados. O seed é idempotente: pode reiniciar o container
quantas vezes quiser sem duplicar nada.

## Rodando localmente (sem Docker para os apps)

Requer Node 20+ e um Postgres acessível.

```bash
npm install

# sobe só o Postgres via Docker
docker compose up -d db

# configure apps/api/.env (veja .env.example) com DATABASE_URL apontando
# para localhost:5432, então:
npm run prisma:migrate --workspace=apps/api
npm run prisma:seed
npm run dev:api    # http://localhost:3001
npm run dev:web    # http://localhost:3000 (outro terminal)
```

## Testes

```bash
npm run test:api               # unitários (Prisma mockado)
docker compose up -d db        # necessário para os testes de integração
npm run test:api:integration   # concorrência real de estoque contra o Postgres
```

Os testes de integração (`apps/api/test/inventory-concurrency.int-spec.ts`)
sobem duas, e depois dez, reservas simultâneas disputando o mesmo SKU contra
um Postgres real, provando que o lock de linha (`SELECT ... FOR UPDATE`)
serializa as escritas — e que a CHECK constraint do banco rejeita qualquer
tentativa de deixar `available` negativo mesmo por fora da aplicação.

## Arquitetura e decisões

**Reserva de estoque.** `InventoryService.applyReservation` roda dentro de
uma transação, bloqueia (`FOR UPDATE`) todas as linhas de `Inventory`
envolvidas em ordem determinística de `productId` (evita deadlock entre
reservas concorrentes multi-item), decide se há saldo e só então decrementa
`available`/incrementa `reserved`. Cada reserva também vira uma linha em
`InventoryReservation` — um ledger auditável e reversível — em vez de só
mexer nos contadores agregados. Uma `CHECK` constraint no Postgres
(migration `add_inventory_check_constraints`) é o último backstop: mesmo um
bug na camada de aplicação não consegue deixar o estoque negativo.

**Máquina de estados do pedido.** As transições válidas e o papel mínimo
exigido por transição vivem em `orders/order-status.util.ts`, checadas antes
de qualquer escrita. Cancelamento só é permitido até `PACKED` — depois que o
pedido é expedido, a operação não pode mais cancelar unilateralmente.

**Ondas de separação.** Uma onda agrupa os itens de vários pedidos
`RESERVED` por produto (Produto A → 42 un., não pedido por pedido) e gera
uma `PickingTask` por SKU. Concluir uma tarefa consome exatamente o total
ledgerado de reservas daquele produto na onda (não a quantidade nominal da
tarefa), então os contadores de estoque nunca podem divergir do ledger.

**Tempo real.** Um único `RealtimeGateway` (WebSocket, namespace
`/realtime`) autentica pelo mesmo cookie JWT da API REST e emite eventos de
domínio (`order.status_changed`, `inventory.updated`, `alert.created`,
`wave.created`, `task.updated`, ...). O frontend escuta esses eventos para
invalidar as queries do TanStack Query afetadas e mostrar um toast — sem
polling.

**Alertas automáticos.** `AlertsService` roda a cada minuto
(`@nestjs/schedule`) e varre estoque crítico, pedidos atrasados, pedidos
parados há mais de 12h na mesma etapa e transportadoras com taxa de atraso
acima de 30%. Cada regra é idempotente: só abre um novo alerta se não
existir um já `OPEN` para a mesma entidade, então rodar a cada minuto não
inunda a central de alertas.

**Autorização.** `JwtAuthGuard` e `RolesGuard` são globais (`APP_GUARD` em
`app.module.ts`) — toda rota exige um JWT válido por padrão (`@Public()`
para as exceções) e checa `@Roles(...)` quando declarado. A validação
acontece inteiramente no backend; o frontend só reflete o que o usuário tem
permissão de ver/fazer.

**Auditoria.** `AuditService.log(...)` aceita opcionalmente o client de
transação, então o registro de auditoria comita atomicamente junto com a
mudança que ele descreve — nunca como um evento separado que pode se perder.

## Estrutura

```
apps/
  api/     NestJS — auth, users, carriers, inventory, orders, picking,
           alerts, dashboard, audit, realtime
  web/     Next.js — dashboard, central de pedidos, ondas de separação,
           estoque, transportadoras, alertas, usuários, auditoria
```

## Variáveis de ambiente

Veja [.env.example](.env.example). O mesmo arquivo alimenta o
`docker-compose.yml` e, copiado para `apps/api/.env` / `apps/web/.env.local`
com `localhost` no lugar dos nomes de serviço, o desenvolvimento local.

## CI

`.github/workflows/ci.yml` roda em toda PR/push para `main`: lint → type
check → testes (unitários e de integração, contra um Postgres de serviço) →
build, para a API e para o web.

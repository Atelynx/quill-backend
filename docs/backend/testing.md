# Testing

## Suite actual

Backend usa Jest (unitarios) y Supertest (e2e).

```bash
npm test            # Unitarios
npm run test:e2e    # E2E
npm run test:cov    # Cobertura
```

## Validación local y CI

El proyecto usa la versión de Node definida en `.nvmrc`. La validación no
modificadora ejecutada por CI es:

```bash
npm ci
npm run typecheck
npm run build
npm test -- --runInBand
npm run lint:check
```

`npm run lint` mantiene el autofix para desarrollo local. CI usa
`npm run lint:check` para validar sin modificar archivos.

## Healthchecks

- `GET /api/system/health/live`: liveness del proceso.
- `GET /api/system/health/ready`: readiness; responde HTTP 503 si MongoDB no
  esta disponible.
- `GET /api/system/health`: alias compatible de readiness.

Redis usa fallback en memoria cuando no esta disponible, por lo que readiness
queda degradado pero operativo. El healthcheck de producción usa readiness.

## Cobertura unitaria

Servicios con tests: `AuthService`, `CommissionService`, `OrderExecutionService`, `OrdersService`, `PortfolioService`, `UsersService`, `HealthService`, `TradesService`, `MarketService`.

## Cobertura e2e

Casos cubiertos: healthcheck, registro/login, email duplicado, creación/ejecución de órdenes, impacto en portfolio y trades, reserva/ejecución SELL, rechazo por saldo/acciones insuficientes, rollback transaccional.

## Infraestructura

E2E usa `mongodb-memory-server` con replica set (necesario para transacciones).

## Escenarios financieros (`test/order-financial.e2e-spec.ts`)

Usa símbolos deterministas (`SELL.SN`, `BUY.SN`, `RBACK.SN`). Cubre:

- Venta con acciones suficientes
- Compra rechazada por saldo insuficiente (incluyendo comisión)
- Venta rechazada por acciones insuficientes
- Cálculo de comisión y neto en SELL
- Redondeos financieros a 2 decimales
- Rollback completo ante falla controlada
- Tick de ejecución sin llamar `refreshMarket()`

## Comandos útiles

```bash
npm test -- --runInBand --runTestsByPath src/modules/orders/application/services/orders.service.spec.ts
npm test -- order-execution orders-service-edges --runInBand
npm run test:e2e -- --runTestsByPath test/order-financial.e2e-spec.ts
```

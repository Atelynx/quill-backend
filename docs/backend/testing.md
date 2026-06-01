# Testing

## Suite actual

Backend usa Jest (unitarios) y Supertest (e2e).

```bash
npm test            # Unitarios
npm run test:e2e    # E2E
npm run test:cov    # Cobertura
```

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

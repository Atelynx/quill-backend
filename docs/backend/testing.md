# Testing

## Suite actual

El backend usa Jest para unitarios y Supertest para e2e.

Scripts relevantes:

- `npm test`
- `npm run test:e2e`
- `npm run test:cov`

## Cobertura unitaria actual

Servicios con pruebas unitarias:

- `AuthService`
- `CommissionService`
- `OrdersService`
- `PortfolioService`
- `UsersService`
- `HealthService`
- `TradesService`
- `MarketService`

## Cobertura e2e actual

Casos cubiertos:

- healthcheck
- registro de usuario
- rechazo de email duplicado
- login correcto
- rechazo de credenciales invalidas
- creacion de orden
- ejecucion automatica
- impacto en portfolio y trades
- reserva y ejecucion de ordenes SELL con cotizaciones persistidas
- rechazo de BUY sin saldo y SELL sin acciones sin estado parcial
- rollback transaccional cuando falla la creacion del trade
- proteccion del tick de ejecucion para no disparar refresh externo

## Infraestructura de testing

El e2e usa:

- `mongodb-memory-server`
- replica set local en memoria

Esto es importante porque la ejecucion de ordenes usa transacciones y necesita replica set para comportarse como produccion.

## Escenarios financieros criticos

La suite `test/order-financial.e2e-spec.ts` usa simbolos locales y
deterministas como `SELL.SN`, `BUY.SN` y `ROLLBACK.SN`. No consume EODHD ni
proveedores externos.

Escenarios cubiertos:

- venta valida con acciones suficientes, reserva de acciones y ejecucion;
- compra rechazada por saldo insuficiente, considerando comision estimada;
- venta rechazada por acciones insuficientes;
- calculo de comision y neto de trade en ejecucion SELL;
- redondeos financieros a dos decimales en reservas y comisiones;
- rollback de usuario, posicion, orden y trade ante falla controlada;
- tick de ejecucion basado en `MarketService.listQuotes()` sin llamar
  `refreshMarket()`.

Comandos utiles:

- `npm test -- --runInBand --runTestsByPath src/modules/orders/application/services/orders.service.spec.ts`
- `npm run test:e2e -- --runTestsByPath test/order-financial.e2e-spec.ts`

## Areas que todavia merecen mas cobertura

- errores y fallback de `CacheService`
- seeds y refresh de mercado con snapshots
- validaciones DTO a nivel e2e
- escenarios de concurrencia o doble ejecucion

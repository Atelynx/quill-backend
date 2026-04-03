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

## Infraestructura de testing

El e2e usa:

- `mongodb-memory-server`
- replica set local en memoria

Esto es importante porque la ejecucion de ordenes usa transacciones y necesita replica set para comportarse como produccion.

## Areas que todavia merecen mas cobertura

- errores y fallback de `CacheService`
- ramas de ejecucion `SELL` en `OrderExecutionService`
- seeds y refresh de mercado con snapshots
- validaciones DTO a nivel e2e
- escenarios de concurrencia o doble ejecucion

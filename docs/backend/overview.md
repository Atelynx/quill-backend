# Backend Overview

## Stack

- NestJS 11, TypeScript
- MongoDB + Mongoose, Redis (fallback en memoria)
- JWT (Passport), Socket.IO
- Decimal.js para precisión financiera

## Bootstrap (`src/main.ts`)

- Crea app Nest, aplica helmet/compression/CORS
- `ValidationPipe` global, `HttpExceptionFilter`
- Prefijo global `/api`

## Módulo raíz (`src/app.module.ts`)

Carga configuración global (Joi), MongoDB, Scheduler, EventEmitter, módulos funcionales.

## Tiempo real

Socket.IO en namespace `/realtime`. El `RealtimeGateway` sigue la **Megaphone Rule**: sin lógica de negocio, solo escucha eventos internos (`@nestjs/event-emitter`) y los reenvía a salas `stock:SYMBOL` o `forex:SYMBOL`.

## Proveedor de mercado desacoplado

`MarketDataProvider` abstracto. Por defecto `mock` (sin credenciales). También `eodhd` para datos reales con refresh diario y fallback a snapshot/mock si la API falla. EODHD solo se consulta en el scheduler, nunca en requests REST o WebSocket.

## Cache híbrida

`CacheService` intenta Redis; si no responde, usa un fallback en memoria que
respeta TTL y limita su tamaño a 1000 entradas con expulsión de la más antigua.

## Swagger

Swagger se habilita por defecto en desarrollo y test. En producción permanece
deshabilitado salvo que `SWAGGER_ENABLED=true` se configure explícitamente.

## Piezas transversales

- **Auth**: `JwtStrategy` + `JwtAuthGuard` + `CurrentUser` decorator
- **Errores**: `HttpExceptionFilter` unifica respuestas (`statusCode`, `path`, `timestamp`, `message`, `error`)
- **Persistencia**: `users`, `stocks`, `price_snapshots`, `orders`, `positions`, `trades`

## Separación por capas

Cada módulo: `domain` (entidades), `application` (servicios), `infrastructure` (esquemas/proveedores), `presentation` (controladores/gateways).

## Módulos funcionales

- `auth`: registro, login, JWT
- `users`: perfil, saldo inicial
- `market`: catálogo, precios, snapshots
- `orders`: órdenes límite y market, ejecución
- `portfolio`: posiciones, equity, PnL
- `trades`: historial de operaciones
- `realtime`: WebSocket gateway
- `system`: healthcheck, cache
- `currency`: forex sintético (Anchor + Noise)

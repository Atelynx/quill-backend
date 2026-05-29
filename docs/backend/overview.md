# Backend Overview

## Stack principal

- NestJS 11
- TypeScript
- MongoDB con Mongoose
- Redis con fallback en memoria
- JWT con Passport
- Scheduler interno para ticks de mercado
- WebSockets con Socket.IO

## Precisión Financiera

Se utiliza **Decimal.js** para todos los cálculos monetarios. Esto evita errores de precisión de punto flotante de JavaScript que pueden afectar cálculos de balance, comisiones y valores de portafolio.

## Actualizaciones en Tiempo Real

**Socket.IO** implementa un gateway WebSocket en el namespace `/realtime` que difunde cotizaciones de precios a los clientes suscritos.

El `RealtimeGateway` actúa como un megáfono: no contiene lógica de negocio, ni cron jobs, ni llamadas externas. Solo escucha eventos internos vía `@nestjs/event-emitter` y los reenvía a las salas correspondientes.

Cuando `MarketRefreshService` emite `internal.price.update`, el gateway captura el evento y emite `price_update` a la sala `stock:SYMBOL`. Los clientes se suscriben enviando `subscribe: { topic: string }` y se desuscriben con `unsubscribe: { topic: string }`.

## Proveedor de Datos de Mercado Desacoplado

El sistema usa un patrón **`MarketDataProvider`** abstracto. Por defecto corre con el proveedor `mock`, que permite ejecutar el proyecto sin credenciales externas. También puede usar `eodhd` para datos de mercado chileno con refresh diario, snapshots persistidos y fallback a datos guardados o mock si la API externa falla.

EODHD no se consulta en cada request REST ni en cada conexión WebSocket. El scheduler diario, configurable con `EODHD_DAILY_REFRESH_CRON`, es el único flujo con permiso de hacer llamadas reales. Antes de llamar a EODHD se revisan snapshots `source=eodhd` del día; si ya existen, se reutilizan.

## Estrategia de Cache Híbrida

El **`CacheService`** intenta usar Redis cuando está disponible. Si Redis no responde, automáticamente cae a un cache en memoria usando `Map`. Esto garantiza que la demo nunca se detiene por fallos de infraestructura externa.

## Punto de entrada

El backend inicia en `src/main.ts`.

Acciones principales en el bootstrap:

- crea la aplicacion Nest
- aplica `helmet` y `compression`
- habilita CORS con `FRONTEND_ORIGIN`
- registra `ValidationPipe` global
- registra `HttpExceptionFilter`
- define el prefijo global `/api`

## Modulo raiz

`src/app.module.ts` carga:

- configuracion global con validacion Joi
- conexion a MongoDB
- scheduler global
- EventEmitterModule para eventos internos
- modulos funcionales del backend

## Configuracion de entorno

Variables importantes:

- `BACKEND_PORT`
- `FRONTEND_ORIGIN`
- `MONGODB_URI`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `INITIAL_BALANCE`
- `COMMISSION_RATE`
- `MARKET_PROVIDER`
- `MARKET_FETCH_ON_STARTUP`
- `MARKET_TICK_INTERVAL_SECONDS`
- `EODHD_API_KEY`
- `EODHD_BASE_URL`
- `EODHD_EXCHANGE_CODE`
- `EODHD_SYMBOLS`
- `EODHD_DAILY_REFRESH_ENABLED`
- `EODHD_DAILY_REFRESH_CRON`
- `EODHD_CACHE_TTL_SECONDS`

La validacion esta centralizada en `src/config/env.validation.ts`.

`EODHD_API_KEY` solo es obligatoria cuando `MARKET_PROVIDER=eodhd`. No debe
versionarse ni exponerse. `.env.example` deja el valor vacío a propósito.

## Piezas transversales

### Autenticacion

- `JwtStrategy` extrae el token Bearer y valida firma y expiracion.
- `JwtAuthGuard` protege endpoints privados.
- `CurrentUser` entrega el payload JWT ya validado.

### Manejo de errores

`HttpExceptionFilter` unifica la forma de responder errores HTTP y errores inesperados.

Formato base de respuesta:

- `statusCode`
- `path`
- `timestamp`
- `message`
- `error`

### Cache

`CacheService` intenta conectarse a Redis al iniciar.

Si Redis no esta disponible:

- desactiva la conexion externa
- usa un `Map` en memoria
- mantiene el backend operativo para demo y desarrollo

## Persistencia

Colecciones principales:

- `users`
- `stocks`
- `price_snapshots`
- `orders`
- `positions`
- `trades`

## Separacion por capas

## Modulos funcionales

- `auth`: registro, login, JWT, hashing de contraseñas
- `users`: perfil básico, saldo inicial ficticio y lectura del usuario autenticado
- `market`: catálogo de acciones, precios actuales, snapshots históricos y proveedor de mercado
- `orders`: creación y consulta de órdenes limitadas de compra y venta
- `portfolio`: posiciones del usuario, métricas del portafolio y resumen del dashboard
- `trades`: historial de operaciones ejecutadas
- `realtime`: gateway WebSocket para difusión de precios en vivo
- `system`: healthcheck, configuración, seeds y utilidades transversales

## Separacion por capas

Cada modulo funcional sigue una estructura similar:

- `domain`: entidades y constantes del negocio
- `application`: servicios y casos de uso
- `infrastructure`: esquemas, estrategias y adaptadores
- `presentation`: controladores REST, gateways y DTOs

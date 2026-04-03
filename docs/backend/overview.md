# Backend Overview

## Stack principal

- NestJS 11
- TypeScript
- MongoDB con Mongoose
- Redis con fallback en memoria
- JWT con Passport
- Scheduler interno para ticks de mercado
- WebSockets con Socket.IO

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
- `MARKET_TICK_INTERVAL_SECONDS`

La validacion esta centralizada en `src/config/env.validation.ts`.

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

Cada modulo funcional sigue una estructura similar:

- `domain`: entidades y constantes del negocio
- `application`: servicios y casos de uso
- `infrastructure`: esquemas, estrategias y adaptadores
- `presentation`: controladores REST, gateways y DTOs

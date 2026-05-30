# Backend Modules

## Auth

Responsabilidad:

- registrar usuarios
- validar credenciales
- emitir JWT

Archivos clave:

- `src/modules/auth/application/services/auth.service.ts`
- `src/modules/auth/presentation/controllers/auth.controller.ts`
- `src/modules/auth/infrastructure/strategies/jwt.strategy.ts`

Detalles:

- usa `bcrypt` para hash y verificacion de contrasena
- delega la creacion y lectura de usuarios a `UsersService`

## Users

Responsabilidad:

- crear usuarios persistidos
- asignar saldo inicial
- entregar el perfil autenticado

Archivos clave:

- `src/modules/users/application/services/users.service.ts`
- `src/modules/users/presentation/controllers/users.controller.ts`
- `src/modules/users/infrastructure/schemas/user.schema.ts`

Detalles:

- normaliza el correo a lowercase
- evita duplicados por email
- expone solo datos publicos del perfil

## Market

Responsabilidad:

- mantener el catalogo de acciones
- exponer precios actuales
- guardar historial de snapshots
- emitir eventos de actualizacion via event bus

Archivos clave:

- `src/modules/market/application/services/market.service.ts`
- `src/modules/market/infrastructure/providers/mock-market-data.provider.ts`
- `src/modules/market/presentation/controllers/market.controller.ts`
- `src/modules/market/application/services/market-refresh.service.ts`

Detalles:

- siembra acciones iniciales al arrancar si la coleccion esta vacia
- calcula variacion diaria respecto a `previousClose`
- guarda snapshots en cada refresh
- emite `internal.price.update` via EventEmitter al refrescar cotizaciones

## Orders

Responsabilidad:

- crear ordenes limitadas de compra y venta
- reservar saldo o posiciones
- ejecutar ordenes cuando el mercado cumple la condicion

Archivos clave:

- `src/modules/orders/application/services/orders.service.ts`
- `src/modules/orders/application/services/order-execution.service.ts`
- `src/modules/orders/application/services/commission.service.ts`
- `src/modules/orders/presentation/controllers/orders.controller.ts`

Detalles:

- `BUY`: reserva saldo usando precio limite mas comision estimada
- `SELL`: reserva cantidad disponible desde la posicion
- las ejecuciones se procesan dentro de transacciones Mongo

## Portfolio

Responsabilidad:

- construir el resumen financiero del usuario
- enriquecer posiciones con precio de mercado
- calcular equity y PnL no realizado

Archivos clave:

- `src/modules/portfolio/application/services/portfolio.service.ts`
- `src/modules/portfolio/presentation/controllers/portfolio.controller.ts`
- `src/modules/portfolio/infrastructure/schemas/position.schema.ts`

Detalles:

- mezcla posiciones persistidas con cotizaciones actuales
- filtra posiciones con cantidad efectiva igual a cero

## Trades

Responsabilidad:

- listar operaciones ejecutadas del usuario

Archivos clave:

- `src/modules/trades/application/services/trades.service.ts`
- `src/modules/trades/presentation/controllers/trades.controller.ts`
- `src/modules/trades/infrastructure/schemas/trade.schema.ts`

Detalles:

- devuelve operaciones ordenadas por fecha de ejecucion descendente
- permite limitar cantidad de resultados

## System

Responsabilidad:

- exponer estado del sistema
- centralizar cache compartida

Archivos clave:

- `src/modules/system/application/services/health.service.ts`
- `src/modules/system/application/services/cache.service.ts`
- `src/modules/system/presentation/controllers/system.controller.ts`

Detalles:

- informa estado de MongoDB
- informa si Redis esta operativo o en fallback

## Currency

Responsabilidad:

- generar datos sintéticos de tipo de cambio para pares forex
- minimizar consumo de APIs externas via arquitectura Anchor + Noise
- almacenar precios en Redis y emitir eventos internos

Archivos clave:

- `src/modules/currency/application/services/currency-anchor.service.ts`
- `src/modules/currency/application/services/currency-tick.service.ts`
- `src/modules/currency/infrastructure/providers/mock-currency-data.provider.ts`
- `src/modules/currency/domain/interfaces/currency-data-provider.interface.ts`

Detalles:

- dos ticks sincronizados: `CURRENCY_API_REQ_TICK` (hourly cron) y `CURRENCY_RT_TICK` (setInterval cada 5s)
- reusa las mismas estrategias de simulacion del modulo de acciones via `CommonStrategiesModule`
- precios almacenados en Redis como `forex:{symbol}:base_price` y `forex:{symbol}:live_price`
- emite `internal.currency.update` via EventEmitter, escuchado por RealtimeGateway y reenviado a sala `forex:{symbol}`
- no usa MongoDB, no importa WebSocketGateway directamente

## Realtime

Responsabilidad:

- gestionar conexiones WebSocket de clientes
- autenticar clientes via JWT
- manejar suscripciones a canales de datos (rooms)
- escuchar eventos internos y reenviarlos a los clientes suscritos

Archivos clave:

- `src/modules/realtime/presentation/gateways/realtime.gateway.ts`
- `src/modules/realtime/realtime.module.ts`

Detalles:

- opera en el namespace `/realtime`
- clientes se autentican enviando JWT en `socket.handshake.auth.token`
- suscripcion via mensaje `subscribe: { topic: string }`
- canales con prefijo `stock:SYMBOL` y `user:USER_ID`
- escucha `internal.price.update` y emite `price_update` a la sala correspondiente
- sigue la Megaphone Rule: sin cron jobs, sin API calls, sin logica de negocio

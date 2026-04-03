# Backend API

Base path global: `/api`

## Auth

### `POST /auth/register`

Crea una cuenta nueva.

Body:

- `fullName`
- `email`
- `password`

Respuesta:

- mensaje de cuenta creada
- email registrado

### `POST /auth/login`

Autentica al usuario y devuelve token JWT.

Body:

- `email`
- `password`

Respuesta:

- `accessToken`
- `user`

## Users

### `GET /users/me`

Devuelve el perfil del usuario autenticado.

Requiere:

- Bearer token

## Market

### `GET /market/stocks`

Lista todas las acciones del catalogo con su precio actual.

### `GET /market/stocks/:symbol/history`

Devuelve snapshots historicos de una accion.

Query params:

- `limit` opcional, por defecto `24`

### `GET /market/top-movers`

Devuelve las acciones con mayor variacion diaria positiva.

## Orders

### `POST /orders`

Crea una orden limitada.

Requiere:

- Bearer token

Body:

- `symbol`
- `side`: `BUY` o `SELL`
- `quantity`
- `limitPrice`

Comportamiento:

- en compra reserva saldo
- en venta reserva acciones disponibles
- crea la orden en estado `PENDING`

### `GET /orders`

Lista las ordenes del usuario autenticado.

Requiere:

- Bearer token

Query params:

- `status` opcional

## Portfolio

### `GET /portfolio/summary`

Devuelve:

- saldos
- valor invertido
- equity total
- PnL no realizado
- posiciones enriquecidas

Requiere:

- Bearer token

## Trades

### `GET /trades`

Lista operaciones ejecutadas del usuario autenticado.

Requiere:

- Bearer token

Query params:

- `limit` opcional, por defecto `20`

## System

### `GET /system/health`

Devuelve salud basica del backend.

Respuesta:

- `status`
- `services.mongodb`
- `services.redis`
- `timestamp`

## WebSocket

Evento emitido por el backend:

- `market.quotes`: lista de cotizaciones actualizadas

# Changelog — API Consumer Guide

This changelog documents every REST API endpoint, WebSocket event, and feature added to the backend, written from the frontend consumer's perspective.

---

## Table of Contents

- [v1.1.0 — Profile + Multi-Currency](#v110--profile--multi-currency)
  - [New REST endpoints](#new-rest-endpoints)
  - [Changed REST endpoints](#changed-rest-endpoints)
  - [WebSocket API](#websocket-api)
  - [Environment variables](#environment-variables)
- [v1.0.0 — MVP](#v100--mvp)
  - [REST API reference](#rest-api-reference)
  - [WebSocket API reference](#websocket-api-reference)

---

## v1.1.0 — Profile + Multi-Currency

### New REST endpoints

#### Users module (JWT required)

| Method | Route | Request body | Response | Description |
|--------|-------|------|----------|-------------|
| `PATCH` | `/users/me` | `{ fullName?: string, username?: string }` | Full user profile | Update name or username (letters, numbers, underscores only) |
| `PATCH` | `/users/me/email` | `{ currentPassword: string, newEmail: string }` | `{ message }` | Change email. **Re-login required.** |
| `PATCH` | `/users/me/password` | `{ currentPassword: string, newPassword: string }` | `{ message }` | Change password (min 8 chars). **Re-login required.** |
| `GET` | `/users/me/watchlist` | — | `Stock[]` | Watchlist with live stock data (price, change, etc.) |
| `POST` | `/users/me/watchlist` | `{ symbols: string[] }` | `{ watchlist: string[] }` | Add symbols to watchlist |
| `DELETE` | `/users/me/watchlist/:symbol` | — | `{ watchlist: string[] }` | Remove symbol from watchlist |
| `GET` | `/users/me/friends` | — | `Friend[]` | List accepted friends |
| `GET` | `/users/me/friends/requests` | — | `FriendRequest[]` | List incoming pending requests |
| `POST` | `/users/me/friends/:userId` | — | `{ message }` | Send friend request |
| `PATCH` | `/users/me/friends/:userId` | `{ status: "accepted" }` | `{ message }` | Accept incoming friend request |
| `DELETE` | `/users/me/friends/:userId` | — | `{ message }` | Remove friend or cancel request |

#### Currency module (public)

| Method | Route | Response | Description |
|--------|-------|----------|-------------|
| `GET` | `/currency/rates` | `CurrencyRate[]` | All forex pairs with live rate, base price, day change |
| `GET` | `/currency/rates/:symbol` | `CurrencyRate` | Single forex pair (e.g. `USDCLP`) |

### Changed REST endpoints

#### `POST /auth/register` (public)

Request body now accepts optional `username`:

```json
{
  "fullName": "Ana Pérez",
  "email": "ana@example.com",
  "password": "secret123",
  "username": "ana_perez"    // optional, auto-generated if omitted
}
```

Response now includes `username`:

```json
{
  "message": "Cuenta creada correctamente. Inicia sesion para continuar.",
  "email": "ana@example.com",
  "username": "ana_perez"
}
```

#### `POST /auth/login` (public)

Response now includes `username` and `watchlist` in the `user` object:

```json
{
  "accessToken": "jwt...",
  "user": {
    "id": "...",
    "fullName": "Ana Pérez",
    "email": "ana@example.com",
    "username": "ana_perez",
    "availableBalance": 10000000,
    "reservedBalance": 0,
    "watchlist": ["AAPL", "MSFT"]
  }
}
```

#### `POST /orders` (JWT required)

New optional `type` field: `"LIMIT"` (default) or `"MARKET"`.

- **MARKET orders**: Execute immediately at the live price from Redis. No `limitPrice` needed. Returns with `status: "EXECUTED"`, `executionPrice`, `commissionAmount`, `executedAt`.
- **LIMIT orders**: Same as before — `limitPrice` required, `status: "PENDING"`.
- If no live price is available for a MARKET order, returns `404`.

```json
// MARKET order example
{
  "symbol": "AAPL",
  "side": "BUY",
  "quantity": 10,
  "type": "MARKET"
}
```

#### `GET /portfolio/summary` (JWT required)

Portfolio totals (`investedValue`, `totalEquity`, `unrealizedProfitLoss`) are now converted to **CLP** using the forex live rate. Per-position values (`averageCost`, `marketPrice`, `marketValue`) remain in the stock's native currency.

#### User profile responses (`GET /users/me`, `PATCH /users/me`)

Now include `username` and `watchlist`:

```json
{
  "id": "...",
  "fullName": "Ana Pérez",
  "email": "ana@example.com",
  "username": "ana_perez",
  "availableBalance": 10000000,
  "reservedBalance": 0,
  "watchlist": ["AAPL", "MSFT"]
}
```

### WebSocket API

#### Connection

```
socket = io("wss://<host>/realtime", {
  auth: { token: "jwt..." }
})
```

#### Client → Server events

| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe` | `{ topic: string, type?: "stock" \| "forex" }` | Join a room. `type` defaults to `"stock"`. |
| `unsubscribe` | `{ topic: string, type?: "stock" \| "forex" }` | Leave a room. |
| `disconnect` | — | Disconnect. |

#### Server → Client events

| Event | Payload | Description |
|-------|---------|-------------|
| `price_update` | `{ symbol: string, price: number, dayChangePercentage?: number, timestamp: Date }` | Broadcast to room when price changes. |

#### Room naming

| Room pattern | Source data | Subscribe example |
|---|---|---|
| `stock:AAPL` | Stock price updates | `{ topic: "AAPL" }` or `{ topic: "AAPL", type: "stock" }` |
| `forex:USDCLP` | Forex rate updates | `{ topic: "USDCLP", type: "forex" }` |
| `user:{userId}` | Auto-joined on auth | (automatic) |

### Environment variables

New env vars for the frontend to be aware of:

| Variable | Default | Description |
|---|---|---|
| `CURRENCY_PROVIDER` | `mock` | `mock` or `exchangeRate` |
| `CURRENCY_SIMULATION_STRATEGY` | `flat` | `flat`, `gbm`, `nw` |

---

## v1.0.0 — MVP

### REST API reference

#### Auth (public)

| Method | Route | Request | Response |
|--------|-------|---------|----------|
| `POST` | `/auth/register` | `{ fullName, email, password, username? }` | `{ message, email, username }` |
| `POST` | `/auth/login` | `{ email, password }` | `{ accessToken, user }` |

**Login response `user` shape:**

```json
{
  "id": "string",
  "fullName": "string",
  "email": "string",
  "username": "string | null",
  "availableBalance": 10000000,
  "reservedBalance": 0,
  "watchlist": []
}
```

#### Users (JWT required)

| Method | Route | Request | Response |
|--------|-------|---------|----------|
| `GET` | `/users/me` | — | User profile |

#### Market (public)

| Method | Route | Query params | Response |
|--------|-------|-------------|----------|
| `GET` | `/market/stocks` | — | `Stock[]` (cached 10s) |
| `GET` | `/market/stocks/:symbol/history` | `?limit=24` | `PriceSnapshot[]` |
| `GET` | `/market/top-movers` | — | `Stock[]` (top 4 by day change) |

**`Stock` shape:**

```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "currency": "USD",
  "close": 150.25,
  "previousClose": 148.00,
  "dayChangePercentage": 1.52,
  "baseVolatility": 0.02,
  "baseDrift": 0.0001
}
```

#### Orders (JWT required)

| Method | Route | Request | Response |
|--------|-------|---------|----------|
| `POST` | `/orders` | `{ symbol, side, quantity, type?, limitPrice? }` | `Order` |
| `GET` | `/orders` | `?status=PENDING\|EXECUTED\|CANCELLED` | `Order[]` |

**`Order` shape:**

```json
{
  "_id": "string",
  "userId": "string",
  "symbol": "AAPL",
  "side": "BUY | SELL",
  "type": "LIMIT | MARKET",
  "quantity": 10,
  "limitPrice": 150.00,
  "status": "PENDING | EXECUTED | CANCELLED",
  "reservedAmount": 1500.00,
  "executionPrice": 150.25,
  "commissionAmount": 1.50,
  "executedAt": "2026-06-01T12:00:00.000Z",
  "createdAt": "2026-06-01T12:00:00.000Z"
}
```

#### Portfolio (JWT required)

| Method | Route | Response |
|--------|-------|----------|
| `GET` | `/portfolio/summary` | `PortfolioSummary` |

**`PortfolioSummary` shape:**

```json
{
  "availableBalance": 5000000,
  "reservedBalance": 150000,
  "investedValue": 3500000,
  "totalEquity": 3650000,
  "unrealizedProfitLoss": 150000,
  "positions": [
    {
      "symbol": "AAPL",
      "quantity": 10,
      "reservedQuantity": 0,
      "averageCost": 145000,
      "marketPrice": 150250,
      "marketValue": 1502500,
      "unrealizedProfitLoss": 52500
    }
  ]
}
```

> Note: `investedValue`, `totalEquity`, and `unrealizedProfitLoss` are in CLP. Per-position amounts are in the stock's native currency.

#### Trades (JWT required)

| Method | Route | Query params | Response |
|--------|-------|-------------|----------|
| `GET` | `/trades` | `?limit=20` | `Trade[]` |

#### Currency (public)

| Method | Route | Response |
|--------|-------|----------|
| `GET` | `/currency/rates` | `CurrencyRate[]` |
| `GET` | `/currency/rates/:symbol` | `CurrencyRate` |

**`CurrencyRate` shape:**

```json
{
  "symbol": "USDCLP",
  "rate": 950.50,
  "basePrice": 948.00,
  "dayChangePercentage": 0.26
}
```

#### System (public)

| Method | Route | Response |
|--------|-------|----------|
| `GET` | `/system/health` | `{ status, services: { mongodb, redis }, timestamp }` |

### WebSocket API reference

#### Connection

```
Namespace: /realtime
Auth: socket.handshake.auth.token = JWT
      socket.handshake.query.token = JWT (fallback)
```

#### Client → Server

| Event | Payload | Effect |
|-------|---------|--------|
| `subscribe` | `{ topic: "AAPL", type?: "stock" \| "forex" }` | Join room |
| `unsubscribe` | `{ topic: "AAPL", type?: "stock" \| "forex" }` | Leave room |

#### Server → Client

| Event | Payload | Room |
|-------|---------|------|
| `price_update` | `{ symbol, price, dayChangePercentage?, timestamp }` | `stock:{symbol}` or `forex:{symbol}` |

#### Rooms

| Room | Content | Auto-joined |
|------|---------|------------|
| `stock:{symbol}` | Stock price updates | No (subscribe required) |
| `forex:{symbol}` | Forex rate updates | No (subscribe required) |
| `user:{userId}` | User-scoped events | Yes (on auth) |

# Admin Stock Management — API Changelog

Date: 2026-06-14

## Summary

New admin endpoints to manage stocks independently of the active market data provider. Admin-created stocks (`source: 'admin'`) are excluded from provider refresh cycles. The refresh (`MarketRefreshService`) skips stocks with `source: 'admin'`, so they are never sent to EODHD, Mock, or any other provider. Tick simulation still applies to all stocks with Redis keys.

---

## New Endpoints

All endpoints are JWT-protected (`@UseGuards(JwtAuthGuard, RolesGuard)`) and require role `admin`.

---

### `GET /admin/stocks`

List all stocks with search/filter capability.

**Query Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `search` | `string` | No | Filter by symbol or name (case-insensitive, partial match) |
| `source` | `string` | No | Filter by source (`admin`, `mock`, `eodhd`) |
| `page` | `number` | No | Page number (default 1) |
| `limit` | `number` | No | Items per page (default 50) |

**Response `200`:**

```json
{
  "data": [
    {
      "symbol": "COPEC.SN",
      "name": "COPEC.SN",
      "currency": "CLP",
      "close": 6113.44,
      "open": 6200,
      "high": 6220,
      "low": 6136,
      "previousClose": 6159,
      "dayChangePercentage": -0.74,
      "source": "admin",
      "volume": 1371420,
      "baseVolatility": 0.015,
      "baseDrift": 0,
      "createdAt": "2026-06-14T12:00:00.000Z",
      "updatedAt": "2026-06-14T12:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

**Frontend notes:**
- The `source` field distinguishes admin-created stocks (`"admin"`) from provider-managed ones (`"mock"`, `"eodhd"`)
- Display a badge/badge on each row showing the source
- Admin stocks should show an indicator that they won't be refreshed by the provider

---

### `POST /admin/stocks`

Create a new stock managed by the admin (source will be set to `admin`).

**Request Body:**

```json
{
  "symbol": "MYSTOCK",
  "name": "My Custom Stock",
  "currency": "CLP",
  "close": 1500,
  "baseVolatility": 0.02,
  "baseDrift": 0
}
```

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `symbol` | `string` | Yes | — | Uppercased automatically, only letters, numbers, dots |
| `name` | `string` | Yes | — | Min 1 character |
| `currency` | `string` | No | `"CLP"` | — |
| `close` | `number` | Yes | — | Positive number |
| `baseVolatility` | `number` | No | `0.015` | For tick simulation |
| `baseDrift` | `number` | No | `0` | For tick simulation |

**Response `201`:**

```json
{
  "symbol": "MYSTOCK",
  "name": "My Custom Stock",
  "currency": "CLP",
  "close": 1500,
  "previousClose": 1500,
  "dayChangePercentage": 0,
  "source": "admin",
  "baseVolatility": 0.02,
  "baseDrift": 0
}
```

**Error `409`:**

```json
{
  "statusCode": 409,
  "message": "El símbolo \"MYSTOCK\" ya existe."
}
```

**Frontend notes:**
- Show a form with the fields above
- After creation, the stock appears in the stock list with `source: "admin"`
- It will be included in tick simulation (live price updates via WebSocket)
- It will NOT be sent to EODHD or any provider refresh

---

### `PATCH /admin/stocks/:symbol/price`

Update the base price of a stock (admin or provider-managed).

**Request Body:**

```json
{
  "price": 1620.50
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `price` | `number` | Yes | Positive number |

**Response `200`:**

```json
{
  "symbol": "MYSTOCK",
  "close": 1620.5,
  "previousClose": 1500,
  "dayChangePercentage": 8.03,
  "source": "admin",
  "updatedAt": "2026-06-14T12:05:00.000Z"
}
```

**Error `404`:**

```json
{
  "statusCode": 404,
  "message": "Stock \"MYSTOCK\" no encontrado."
}
```

**What happens behind the scenes:**
1. MongoDB `stocks` document is updated (`close`, `previousClose`, `dayChangePercentage`)
2. A `PriceSnapshot` is created for history
3. Redis keys are updated: `market:{symbol}`, `stock:{symbol}:base_price`, `stock:{symbol}:live_price` (all set to the new price)
4. An `internal.price.update` event is emitted → WebSocket clients receive the update in real-time

**Frontend notes:**
- This endpoint modifies **any** stock, regardless of source
- **`source` is never modified** — provider-managed stocks stay managed by their provider
- On the next scheduled refresh, the provider **will overwrite** the price back to the real value
- Show a toast/notification: "Price updated. Next provider refresh will overwrite this value."

---

### `DELETE /admin/stocks/:symbol`

Delete an admin-created stock.

**Response `200`:**

```json
{
  "message": "Stock \"MYSTOCK\" eliminado."
}
```

**Error `404`:**

```json
{
  "statusCode": 404,
  "message": "Stock \"MYSTOCK\" no encontrado."
}
```

**Error `403`:**

```json
{
  "statusCode": 403,
  "message": "No se puede eliminar un stock administrado por el proveedor."
}
```

**Frontend notes:**
- Only stocks with `source: "admin"` can be deleted
- For provider-managed stocks, disable the delete button or show a tooltip explaining why

---

## Existing Modified Behavior

### `GET /market/stocks`

**No changes** to the response shape. The endpoint still returns all stocks (including admin-created ones). Admin stocks will have `source: "admin"` and their current `close` price.

### WebSocket: `price_update` event

Admin price changes emit the same `internal.price.update` event as regular ticks/refreshes. Frontend WebSocket consumers handle it identically — no changes needed.

```typescript
interface PriceUpdate {
  symbol: string;
  price: number;
  close: number;
  dayChangePercentage: number;
  // ...other fields unchanged
}
```

---

## Data Model: `source` Field Semantics

| `source` | Meaning | Managed by provider refresh? | Admin delete? | Admin PATCH overwritten by refresh? |
|----------|---------|------------------------------|---------------|-------------------------------------|
| `"mock"` | Seeded by mock provider | Yes | No | Yes |
| `"eodhd"` | Seeded by EODHD provider | Yes | No | Yes |
| `"admin"` | Created by admin via panel | **No** | Yes | No |

**Admin PATCH never changes `source`.** Provider-managed stocks stay with the provider — the next refresh will overwrite the admin's price. Admin-created stocks (`source: 'admin'`) are excluded from all provider refresh cycles.

---

## Frontend Implementation Order

1. **Admin stock list page** — `GET /admin/stocks` with search + source filter
2. **Create stock form** — `POST /admin/stocks`
3. **Price update inline** — `PATCH /admin/stocks/:symbol/price` (show toast that refresh will overwrite)
4. **Delete stock** — `DELETE /admin/stocks/:symbol` (only for admin-managed)

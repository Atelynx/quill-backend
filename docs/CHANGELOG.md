# Changelog — Currency Exchange Module

## Branch: `feat/currency-exchange`

### Architecture

- **New `CurrencyModule`** — self-contained NestJS module for real-time synthetic forex rates (USDCLP, EURUSD, etc.) using an "Anchor + Noise" two-tick architecture. Redis-only, no MongoDB. Does not import `@WebSocketGateway` (decoupling constraint).

### Refactors

- **Simulation strategies extracted** to shared `CommonStrategiesModule` (`src/modules/common/`):
  - `IMarketSimulationStrategy` interface
  - `GBMMarketSimulationStrategy`, `FlatMarketSimulationStrategy`, `NoiseWaveSimulationStrategy`
  - `StrategyFactory`
  - Both `MarketModule` and `CurrencyModule` import this module independently, eliminating cross-domain coupling.

### Two-Tick System

| Tick | Mechanism | Frequency | Responsible | Description |
|---|---|---|---|---|
| Anchor | `CronJob` | Provider-defined via `{PROVIDER}_REFRESH_CRON` | `CurrencyAnchorService` | Fetches real price from external API, stores as `forex:{symbol}:base_price` |
| Heartbeat | `setInterval` | `CURRENCY_RT_TICK_INTERVAL_SECONDS` (default 5s) | `CurrencyTickService` | Reads base+live price from Redis, applies simulation strategy, stores as `forex:{symbol}:live_price`, emits event |

### Providers

| Provider | Env selector | API calls | Symbols source |
|---|---|---|---|
| `mock` | `CURRENCY_PROVIDER=mock` | None (synthetic) | `MOCK_CURRENCY_SYMBOLS` |
| `exchangeRate` | `CURRENCY_PROVIDER=exchangeRate` | exchangerate-api v6 | `EXCHANGERATE_SYMBOLS` |
| `none` | (fallback) | Throws error | — |

Each provider implements `CurrencyDataProvider` with:
- `getQuote(symbol): Promise<MarketQuote>`
- `getName(): string`
- `getSymbols(): string[]`
- `getRefreshSchedule(): ProviderRefreshSchedule | undefined` (optional — mock returns `undefined`, exchangeRate returns a cron)

### New Environment Variables

**Module-level:**
```
CURRENCY_PROVIDER=mock|exchangeRate
CURRENCY_SIMULATION_STRATEGY=flat|gbm|nw
CURRENCY_RT_TICK_INTERVAL_SECONDS=5
CURRENCY_ANCHOR_VOLATILITY=0.005
CURRENCY_ANCHOR_DRIFT=0
```

**Provider-specific:**
```
MOCK_CURRENCY_SYMBOLS=USDCLP

EXCHANGERATE_API_KEY=
EXCHANGERATE_BASE_URL=https://v6.exchangerate-api.com/v6
EXCHANGERATE_SYMBOLS=USDCLP,EURUSD
EXCHANGERATE_REFRESH_CRON=*/10 * * * * *
```

### Events

| Event | Emitter | Payload | Consumer |
|---|---|---|---|
| `internal.currency.update` | `CurrencyTickService` | `Array<{ symbol, close, dayChangePercentage }>` | `RealtimeGateway` → broadcasts to `forex:{symbol}` room |

### Redis Key Conventions

| Key | Description | Set by |
|---|---|---|
| `forex:{symbol}:base_price` | Anchor price (from external API) | `CurrencyAnchorService` |
| `forex:{symbol}:live_price` | Synthetic real-time price | `CurrencyTickService` |

### WebSocket API Changes

- **Subscribe/unsubscribe** now accepts optional `type` field:
  - `{ topic: "USDCLP", type: "forex" }` → joins `forex:USDCLP` room
  - `{ topic: "AAPL", type: "stock" }` or `{ topic: "AAPL" }` → joins `stock:AAPL` room (default)
- New `forex:{symbol}` room broadcasts `price_update` events for currency pairs.

### Documentation

- `src/modules/currency/README.md` — module-level docs (Spanish) covering Two-Tick flow, Strategy Pattern, Redis keys, providers, and env vars.
- `docs/backend/modules.md` — added Currency section.

### New REST Endpoint

- **`GET /currency/rates`** — returns all tracked forex pairs with their latest live price, base price, and day change percentage.
- **`GET /currency/rates/:symbol`** — returns a single forex pair rate (e.g., `GET /currency/rates/USDCLP`).
- Powered by `CurrencyRateService` which reads directly from Redis (`forex:{symbol}:live_price` and `forex:{symbol}:base_price`).
- Registered via `CurrencyController` at the `currency` route prefix.

### Bug Fixes

- `ExchangeRateCurrencyDataProvider` aligned with exchangerate-api v6 response format:
  - `data.rates` → `data.conversion_rates`
  - `data.updated` → `data.time_last_update_unix`
  - Removed unsupported `Authorization: Bearer` header (API key is passed in URL path).
  - Added `data.result === "success"` check for proper error handling.
  - Default `EXCHANGERATE_BASE_URL` added.
- `CurrencyAnchorService` uses dynamic `CronJob` from provider's `getRefreshSchedule()` instead of hardcoded `@Cron(CronExpression.EVERY_HOUR)`.
- Added `isTicking` concurrency guard in `CurrencyTickService` to prevent overlapping ticks.
- Added `OnModuleInit` seed in `CurrencyAnchorService` — fetches initial anchor immediately on boot.
- `import type` compliance for decorated DI dependency (`CurrencyDataProvider`).

---

## Branch: `feat/instant-order`

### New Feature: MARKET Orders (Instant Execution)

- Added `type: 'LIMIT' | 'MARKET'` field to Order schema (default `'LIMIT'` for backward compatibility).
- `POST /api/orders` now accepts an optional `type` field. When `type: 'MARKET'`:
  - `limitPrice` is ignored (sanitized to `undefined` before processing).
  - The order executes immediately at the current live price from Redis (`stock:<symbol>:live_price`).
  - No balance reservation step — checks `availableBalance` directly at execution time.
  - Created with `status: 'EXECUTED'` directly, skipping the cron-based execution cycle.
  - Returns with `executionPrice`, `commissionAmount`, and `executedAt` set.
- If no live price is available in Redis, the request fails with `404` — the user must use a LIMIT order instead.
- `OrderExecutionService.executeMarketOrder()` reads the live price from `CacheService` and runs the full transactional logic (balance debit/credit, position update, Trade creation) inside a MongoDB session.
- The cron cycle (`processPendingOrders`) naturally skips MARKET orders since they're never `PENDING`.
- `limitPrice` is now optional in the DTO (`@IsOptional()`) to allow MARKET orders without a price.


### Event name constant

The event name `'internal.price.update'` is now exported as `PRICE_UPDATE_EVENT` from `src/modules/market/domain/constants/events.ts`.
If you emit this event, import and use the constant instead of a raw string.

### WebSocket `price_update` payload — no change

The `price_update` WebSocket event still broadcasts:

```
{ symbol, price, dayChangePercentage?, timestamp }
```

No client-side changes needed.

### `MarketQuote.close` now always populated

All code paths that produce a `MarketQuote` now set `close` explicitly.
If you create a `MarketQuote`, always include `close` — it is no longer optional at the persistence boundary.

### Writer contract hardened

`MarketUpdateWriterService.persist()` now reads `update.quote.close` directly (no fallback to `update.quote.price`).
Provide `close` on every quote you pass to the writer.

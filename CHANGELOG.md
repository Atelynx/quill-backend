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

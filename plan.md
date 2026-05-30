
# Feature: Exchange Currency & Synthetic Market Provider

## Goals

Base on the logic of market provider and its abstraction, implement a domain service (The Brain) that **generates** real-time synthetic data for forex pairs (e.g. USDCLP, EURUSD) while optimizing external API token usage. Because the external API has strict rate limits, this module will use an "Anchor and Noise" architecture: it will **fetch (retrieve)** the base price periodically from an external API, apply a micro-movement algorithm to create a live data stream, and **push this data internally** via Event Emitter so the Real-Time Market Gateway can broadcast it to the end-users.

### Expected External Payload Examples

**EODHD-style (forex endpoint):**
```json
{
  "code": "USDCLP.FOREX",
  "timestamp": 1779741120,
  "gmtoffset": 0,
  "open": 900.71,
  "high": 900.71,
  "low": 889.48,
  "close": 894.42,
  "volume": 0,
  "previousClose": 901.48,
  "change": -7.06,
  "change_p": -0.7832
}
```

**exchangerate-api-style:**
```json
{
  "valid": true,
  "updated": 1780070457,
  "base": "USD",
  "rates": {
    "CLP": 970.42
  }
}
```

*Note: The `close` property (or equivalent `price`/`rate`) will be used as the anchor value. The normalization logic lives in each provider.*

## Architecture & Ticks Strategy

The module utilizes two mechanisms to manage data flow and limit API consumption:

* **`CURRENCY_API_REQ_TICK` (The Anchor — CronJob):** A long-interval cron (e.g., every 1 hour) that fetches the real anchor price from the external API and stores it in Redis as `forex:{symbol}:base_price`. Also seeds `forex:{symbol}:live_price` on first run.
* **`CURRENCY_RT_TICK` (The Heartbeat & Bridge — setInterval):** A short-interval interval (e.g., every 5 seconds via `CURRENCY_RT_TICK_INTERVAL_SECONDS`) that reads the `base_price` and `live_price` from Redis, applies an `IMarketSimulationStrategy` to generate a synthetic next price, stores it as `forex:{symbol}:live_price`, and emits the event.
* **Event Emission:** The heartbeat emits an internal NestJS event `internal.currency.update` with an array of `{ symbol, close, dayChangePercentage }`. The centralized Real-Time Market Gateway listens to this event and broadcasts it to `forex:{symbol}` WebSocket rooms.
* **Strict Transaction Pricing:** The `forex:{symbol}:live_price` key in Redis holds the exact price the user sees on screen. Any trade execution **MUST** read this key, not `base_price`, to prevent phantom slippage.

### Deviation from original plan note

The original plan specified `CURRENCY_RT_TICK` as a cron expression, but the final implementation uses `setInterval` with `CURRENCY_RT_TICK_INTERVAL_SECONDS`. This aligns with Rule #4 (Code Consistency): the existing `MarketModule` uses `setInterval` for its high-frequency tick (`MARKET_TICK_INTERVAL_SECONDS`). The cron-based approach is retained for the low-frequency anchor (`CURRENCY_API_REQ_TICK`), mirroring `MarketRefreshScheduler`'s use of `CronJob`.

## Strategy Pattern & Shared Common Module

The `IMarketSimulationStrategy` interface and its three implementations (`FlatMarketSimulationStrategy`, `GBMMarketSimulationStrategy`, `NoiseWaveSimulationStrategy`) plus `StrategyFactory` are extracted from `MarketModule` into a new **shared** `CommonStrategiesModule` at `src/modules/common/`. Both `MarketModule` and `CurrencyModule` import this module independently, avoiding cross-domain coupling.

The currency module registers its own `'CURRENCY_SIMULATION_STRATEGY'` DI token (analogous to `'MARKET_SIMULATION_STRATEGY'`) selected via the `CURRENCY_SIMULATION_STRATEGY` env var.

## Environment Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `CURRENCY_PROVIDER` | string | `mock` | Selects the active provider (`mock`, `external`, `none`) |
| `CURRENCY_SYMBOLS` | string | `USDCLP` | Comma-separated list of forex pairs to track |
| `CURRENCY_SIMULATION_STRATEGY` | string | `flat` | Simulation strategy (`flat`, `gbm`, `nw`) |
| `CURRENCY_API_REQ_TICK` | string | `0 0 * * * *` | Cron expression for the hourly anchor fetch |
| `CURRENCY_RT_TICK_INTERVAL_SECONDS` | number | `5` | Interval in seconds between synthetic ticks |
| `CURRENCY_API_KEY` | string | — | API key for the external exchange provider |
| `CURRENCY_ANCHOR_VOLATILITY` | number | `0.005` | Base volatility for micro-movement simulation |
| `CURRENCY_ANCHOR_DRIFT` | number | `0` | Base drift for micro-movement simulation |

## Implementation Rules & Patterns

1. **Modularity & Injection:** The module must offer a modular injection of the provider. If the primary API changes, it should only require updating the `CURRENCY_PROVIDER` env variable and restarting the container.
2. **Strategy Pattern (Micro-movements):** The real-time synthetic data generation must be decoupled using an `IMarketSimulationStrategy` interface. This allows plugging in different algorithms (e.g., Geometric Brownian Motion) to simulate market noise without affecting the core service.
3. **Strict Transaction Pricing:** When a user executes a trade, the `TradingService` **MUST** use the exact synthetic `CURRENT_PRICE` from Redis (`forex:{symbol}:live_price`) that the user saw on their screen at that millisecond, not the `BASE_PRICE` (`forex:{symbol}:base_price`), to prevent phantom slippage.
4. **Code Consistency:** Follow existing NestJS principles. If Module A implements crons/scheduling in a specific way, this Currency Module must use the same strategy to keep the codebase cohesive. (Hence `setInterval` for the tick, `CronJob` for the anchor.)
5. **Decoupling Constraint:** This module MUST NOT import or interact with `@WebSocketGateway`. It is strictly a domain data producer and must rely entirely on `@nestjs/event-emitter` to pass data out of its domain.

## Redis Key Conventions

| Key | Value | Set by |
|---|---|---|
| `forex:{symbol}:base_price` | number (anchor) | `CurrencyAnchorService` (cron + init) |
| `forex:{symbol}:live_price` | number (synthetic) | `CurrencyTickService` (interval) |

## Git Workflow & Documentation

* **Branching:** Create a new branch `feat/currency-exchange`. Separate changes into descriptive, atomic commits.
* **Unified Documentation:** All documentation (comments on domain interfaces, README updates explaining the Two-Tick flow, Strategy Pattern, and Redis key conventions) MUST be included in the same branch and Pull Request as the code. Do not create a separate docs branch.
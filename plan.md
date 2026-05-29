# Feature: Market Provider Simulation Engine

## Goals

Extend the existing abstract `MarketDataProvider` pattern to inject a market simulation strategy (e.g., Geometric Brownian Motion - GBM). The engine will use two independent schedules to separate the retrieval of real prices (Anchor) from the generation of high-frequency synthetic noise (Heartbeat), outputting results through the existing internal event ecosystem.

## Architecture & Data Flow

### 1. The Anchor (Real Data)

- **Trigger:** Controlled by the existing `MarketRefreshScheduler` configured with `EODHD_DAILY_REFRESH_CRON`.

- **Process:** The active provider (e.g., `EodhdMarketProvider`) fetches the real data via `MarketRefreshService.refreshMarket()`.

- **Persistence:** The historical snapshot is saved in the existing `price_snapshots` collection (with `source=eodhd`). The `stocks` document is updated with the new close price.

- **Cache Reset (Option A):** `MarketUpdateWriterService` updates the cache with **both** keys:
  - `stock:{SYMBOL}:base_price` → the new real price (anchor)
  - `stock:{SYMBOL}:live_price` → **reset to the same real price**
  
  This ensures the synthetic simulation starts fresh from the real price each day, preventing drift. The existing `market:{SYMBOL}` key is also kept for backward compatibility.

### 2. The Heartbeat (Synthetic Noise)

- **Trigger:** Controlled by a **new** `MarketTickScheduler` using `MARKET_TICK_INTERVAL_SECONDS` (via `SchedulerRegistry.addInterval()`). If set to `0`, the scheduler is skipped entirely (zero-latency / fallback to direct provider prices).

- **Process:** A **new** `MarketTickService` (application layer, separate from `MarketRefreshService`) iterates over active symbols. For each symbol it:
  1. Reads `stock:{SYMBOL}:base_price` and `stock:{SYMBOL}:live_price` from `CacheService`
  2. Reads `baseVolatility` and `baseDrift` from the stock's cached data (loaded at startup)
  3. Injects them into the simulation strategy (`IMarketSimulationStrategy`)
  4. Stores the result back to `stock:{SYMBOL}:live_price`

- **Mandatory Precision:** All mathematics within the simulation strategy **MUST** be executed using **Decimal.js** to maintain consistency with the rest of the financial system and avoid floating-point errors.

### 3. Event Emission (Decoupling)

- Both Anchor and Heartbeat emit `internal.price.update` via `@nestjs/event-emitter`. The event payload shape is consistent: `{ symbol, close, dayChangePercentage, source, timestamp }`.

- The `RealtimeGateway` (*presentation* layer, `/realtime` namespace) captures this event and broadcasts to `stock:{SYMBOL}` rooms — no changes needed; it already acts as a pure "megaphone".

### 4. Anchor/Heartbeat Coordination (Option A)

When the Anchor fires and updates `base_price`, it also resets `live_price = base_price`. This means:

- Synthetic ticks always begin from the last known real price
- The gap between real and synthetic is bounded to ~1 trading day of simulated noise
- No cumulative drift across multiple days
- WebSocket clients always see prices anchored to reality, with realistic intraday variation

## Layered Integration (Clean Architecture)

### Domain Layer (`market/domain/`)

- **`IMarketSimulationStrategy.ts`:** Contract: `calculateNextTick(basePrice: Decimal, currentPrice: Decimal, volatility: Decimal, drift: Decimal): Decimal`. Strict use of `Decimal.js`.

### Application Layer (`market/application/`)

- **`MarketTickService.ts`** (new): Orchestrator called by the tick scheduler. Reads cache, calls strategy, writes back to cache, emits event. Separate from `MarketRefreshService` to avoid concurrency lock conflicts and keep responsibilities clean.
- **`MarketRefreshService.ts`**: Unchanged in its core logic. The only addition is that `MarketUpdateWriterService` now writes both `base_price` and `live_price` cache keys after a successful Anchor refresh.
- **`MarketTickScheduler.ts`** (new): Registers a dynamic interval via `SchedulerRegistry` using `MARKET_TICK_INTERVAL_SECONDS`. Skips registration when value is `0`.
- **`MarketRefreshScheduler.ts`**: Unchanged — handles only the daily Anchor cron.

### Infrastructure Layer (`market/infrastructure/`)

- **`strategies/GBMMarketSimulationStrategy.ts`:** Concrete GBM implementation using `Decimal.js`.
- **`strategies/FlatMarketSimulationStrategy.ts`:** Fallback returning `currentPrice` unchanged (useful for testing or when ticks are disabled).

## Changes to Models and Configuration

1. **`stocks` Collection (`Stock` schema + `StockEntity` interface):** Add `baseVolatility` (`number`, default `0.015`) and `baseDrift` (`number`, default `0.00`) fields. These allow per-stock simulation parameters (e.g., a tech stock vs. a traditional bank).

2. **`env.validation.ts`:** Already defines `MARKET_TICK_INTERVAL_SECONDS` (min 5, default 15). No changes needed — the new `MarketTickScheduler` will consume it. When set to `0`, the Heartbeat is deactivated.

3. **`MarketUpdateWriterService.ts`:** Extend the `cacheQuote()` method to also store `stock:{SYMBOL}:base_price` and `stock:{SYMBOL}:live_price` when persisting Anchor data. This is where the Option A reset happens.

## No Changes Needed

- `RealtimeGateway` — already listens to `internal.price.update`
- `MarketRefreshScheduler` — unchanged
- `MarketRefreshService` — core logic unchanged
- `CacheService` — already available globally
- `env.validation.ts` — already has `MARKET_TICK_INTERVAL_SECONDS`

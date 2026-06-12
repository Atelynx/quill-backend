# Hot-Swappable Providers — Implementation Plan

## Phasing

### Phase 1: Factories (safe, no behavior change)
- Absorb `FallbackMarketDataProvider`/`FallbackCurrencyDataProvider` wrapping into the two factories
- No new files, no wiring changes — just moving existing logic inward
- **Checkpoint:** Factory tests still pass (update `eodhd`/`exchangeRate` assertions)

### Phase 2: Market side (isolated)
- Create `MarketDataProviderResolver` + `MarketStrategyResolver`
- Update `market.module.ts` — remove old factory providers, register resolvers
- Update the 4 market consumer services (`market-refresh`, `market-seed`, `market-refresh.scheduler`, `market-tick`)
- **Checkpoint:** Market module tests pass independently

### Phase 3: Currency side (isolated)
- Create `CurrencyDataProviderResolver` + `CurrencyStrategyResolver`
- Update `currency.module.ts`
- Update the 3 currency consumer services (`currency-tick`, `currency-anchor`, `currency-rate`)
- **Checkpoint:** Currency module tests pass independently

### Phase 4: Admin controller + tests
- Remove `RESTART_REQUIRED_KEYS` and `appliesOn: 'restart'` from `admin.controller.ts`
- Update all 7 consumer spec files (inject resolver mocks)
- Add 4 new resolver spec files + 1 e2e test
- **Checkpoint:** Full test suite passes

### Phase 5: Schedule reconciliation on provider swap
- Add `reconcileSchedule()` private method to `MarketRefreshScheduler` and `CurrencyAnchorService`
- Called on `onModuleInit()` AND on every cron tick (`runRefresh` / `handleAnchorCron`)
- Self-corrects: removes old cron if provider changed, adds new one if schedule differs
- Prevents stale crons from running when provider is hot-swapped
- Adds 8 new test cases covering: add cron, remove cron, replace cron, no-op on unchanged
- **Checkpoint:** Full test suite passes

---

## Prerequisites — Before Coding

### 1. Create feature branch

```bash
git checkout -b feat/hot-swappable-providers
```

### 2. Frontend changelog

The `GET /api/admin/config/:key` endpoint previously returned `appliesOn: 'restart'` and `effectiveValue` for `MARKET_PROVIDER` and `SIMULATION_STRATEGY`. After this change, those keys apply **immediately** — no restart needed.

**API change:** Remove any "restart required" UI indicator for these keys. The response body for these keys will no longer include `appliesOn` or `effectiveValue` fields.

Add a changelog entry for the frontend repo documenting that:
- Provider/strategy changes now take effect instantly
- No server restart required after config updates via the admin panel

### 3. Environment variable update

The env vars `MARKET_PROVIDER`, `SIMULATION_STRATEGY`, `CURRENCY_PROVIDER`, and `CURRENCY_SIMULATION_STRATEGY` are no longer read at runtime for provider resolution. They are now **only** used for seeding the initial value in `AdminConfigService.onModuleInit()`.

**Action:**
- Keep these vars in `.env.example` and `env.validation.ts` — they seed the DB on first run
- Update comments in `env.validation.ts` to clarify: "Only used for initial DB seed; changes made via admin panel take effect immediately"
- `ConfigService` is removed from `market.module.ts`, `currency.module.ts`, and `admin.controller.ts` (it was only used for the `useFactory` providers and restart detection)

---

## Problem

`MARKET_PROVIDER`, `SIMULATION_STRATEGY`, `CURRENCY_PROVIDER`, and `CURRENCY_SIMULATION_STRATEGY` are resolved once at module startup via `useFactory` reading from `ConfigService` (env vars). Changing them requires a full process restart (via Docker/Railway), which:

- Drops in-flight requests
- Doesn't coordinate across multiple replicas
- Has 10-15s downtime on Railway
- Returns connection reset to the admin instead of a confirmation

## Solution

Replace module-level factory providers with **resolver services** that read from `AdminConfigService` (DB) at runtime. Each resolver caches the resolved provider by config key and re-creates it when the key changes.

## Design Principle

**Factories own composition; resolvers own caching.** No resolver ever checks a specific provider name. Adding a new provider (even one with fallback wrapping) changes exactly one file: the factory.

## Dependency Analysis

| Dependency | Status |
|---|---|
| `AdminModule` is `@Global()` | ✅ `AdminConfigService` injectable in any module without imports |
| `CommonStrategiesModule` exports all strategies | ✅ Injected by strategy resolvers |
| `OrdersModule` imports `MarketModule` | Only uses `MarketService`, not `MARKET_DATA_PROVIDER` token |
| `'MARKET_DATA_PROVIDER'` export from `MarketModule` | Safe to remove — no external consumer |
| Factory classes used directly (static) by resolvers | ✅ No injection needed |

---

## Files to Modify (8)

### 1. `src/modules/market/infrastructure/providers/market-data-provider.factory.ts`

Move fallback wrapping from `market.module.ts` into the factory:

- Add import: `import { FallbackMarketDataProvider } from './fallback-market-data.provider';`
- Change `case 'eodhd': return eodhdProvider;` → `case 'eodhd': return new FallbackMarketDataProvider(eodhdProvider, mockProvider);`

Now the factory is the single source of truth for provider composition.

### 2. `src/modules/currency/infrastructure/providers/currency-provider.factory.ts`

Same pattern:

- Add import: `import { FallbackCurrencyDataProvider } from './fallback-currency-data.provider';`
- Change `case 'exchangeRate': return exchangeRate;` → `case 'exchangeRate': return new FallbackCurrencyDataProvider(exchangeRateProvider, mockProvider);`

### 3. `src/modules/market/market.module.ts`

**Remove:**
- `'MARKET_DATA_PROVIDER'` factory provider (~25 lines) — including the `if (providerName === 'eodhd')` hardcode
- `'MARKET_SIMULATION_STRATEGY'` factory provider (~20 lines)
- `'MARKET_DATA_PROVIDER'` from `exports`
- Unused imports: `ConfigService`, `FallbackMarketDataProvider`, `GBMMarketSimulationStrategy`, `FlatMarketSimulationStrategy`, `NoiseWaveSimulationStrategy`, `StrategyFactory`, `StrategyType`

**Add to providers:**
- `MarketDataProviderResolver`
- `MarketStrategyResolver`

**Keep:**
- All existing service providers (unchanged)
- Factory-provided providers (`MockMarketDataProvider`, `EodhdMarketDataProvider`, `NoneMarketDataProvider`)
- `MarketDataProviderFactory` import (still used by resolver)
- `CommonStrategiesModule` import (still needed for strategy injection)

### 4. `src/modules/currency/currency.module.ts`

**Remove:**
- `'CURRENCY_DATA_PROVIDER'` factory provider (~25 lines)
- `'CURRENCY_SIMULATION_STRATEGY'` factory provider (~20 lines)
- Unused imports: `ConfigService`, `FallbackCurrencyDataProvider`, strategy classes, `StrategyFactory`, `StrategyType`

**Add to providers:**
- `CurrencyDataProviderResolver`
- `CurrencyStrategyResolver`

**Keep:**
- All existing service providers
- Factory-provided providers (`MockCurrencyDataProvider`, `ExchangeRateCurrencyDataProvider`, `NoneCurrencyDataProvider`)
- `CurrencyProviderFactory` import

### 5. `src/modules/admin/presentation/controllers/admin.controller.ts`

- Remove `RESTART_REQUIRED_KEYS` Set
- Remove `appliesOn: 'restart'` block
- Remove `ConfigService` import and injection

### 6–11. Consumer services (6 files)

Each replaces `@Inject('TOKEN')` with its resolver, and all calls to `this.provider.method()` become `(await this.resolver.getProvider()).method()`.

| Service | Token → Resolver |
|---|---|
| `market-refresh.service.ts` | `MARKET_DATA_PROVIDER` → `MarketDataProviderResolver` |
| `market-seed.service.ts` | `MARKET_DATA_PROVIDER` → `MarketDataProviderResolver` |
| `market-refresh.scheduler.ts` | `MARKET_DATA_PROVIDER` → `MarketDataProviderResolver` (+ `onModuleInit()` becomes `async`) |
| `market-tick.service.ts` | `MARKET_SIMULATION_STRATEGY` → `MarketStrategyResolver` |
| `currency-anchor.service.ts` | `CURRENCY_DATA_PROVIDER` → `CurrencyDataProviderResolver` |
| `currency-rate.service.ts` | `CURRENCY_DATA_PROVIDER` → `CurrencyDataProviderResolver` (+ `getRates()`/`getRate()` become `async`) |
| `currency-tick.service.ts` | Both → Both resolvers (+ `onModuleInit()` becomes `async`) |

### 13 The current resolver pseudo-code has a subtle race:

Request A: reads key="eodhd" from DB
Request B: reads key="mock" from DB (config changed between reads)
Request B: sets cachedKey="mock", cachedProvider=mock
Request A: sets cachedKey="eodhd", cachedProvider=eodhd  ← overwrites B!
Next call: cachedKey="eodhd" but DB now returns "mock" → cache miss → corrected

Impact: Low — self-healing on next call, no data corruption, extremely narrow window. Already implicitly covered by the existing risk table entry "Mid-operation config change."
Mitigation: Create the provider into a local variable before assigning to shared state. This eliminates the most egregious case (cachedKey/provider mismatch) and is a one-line change per resolver:
```
// Instead of:
this.cachedKey = key;
this.cachedProvider = MarketDataProviderFactory.createProvider(key, ...);

// Do:
const provider = MarketDataProviderFactory.createProvider(key, ...);
this.cachedKey = key;
this.cachedProvider = provider;
This ensures cachedKey and cachedProvider are always set atomically relative to other reads (JS is single-threaded), even if a concurrent call overwrites both. The cache always returns consistent pairs.
```
---

## Files to Create (4 resolvers)

### 12. `src/modules/market/application/services/market-data-provider.resolver.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AdminConfigService } from '../../../admin/application/services/admin-config.service';
import { MarketDataProviderFactory } from '../../infrastructure/providers/market-data-provider.factory';
import { MarketDataProvider } from '../../infrastructure/providers/market-data-provider.interface';
import { MockMarketDataProvider } from '../../infrastructure/providers/mock-market-data.provider';
import { EodhdMarketDataProvider } from '../../infrastructure/providers/eodhd-market-data.provider';
import { NoneMarketDataProvider } from '../../infrastructure/providers/none-market-data.provider';

@Injectable()
export class MarketDataProviderResolver {
  private cachedProvider: MarketDataProvider | null = null;
  private cachedKey: string | null = null;

  constructor(
    private readonly adminConfigService: AdminConfigService,
    private readonly mockProvider: MockMarketDataProvider,
    private readonly eodhdProvider: EodhdMarketDataProvider,
    private readonly noneProvider: NoneMarketDataProvider,
  ) {}

  async getProvider(): Promise<MarketDataProvider> {
    const key = String(
      (await this.adminConfigService.get('MARKET_PROVIDER')) ?? 'mock',
    );
    if (this.cachedProvider && this.cachedKey === key) return this.cachedProvider;

    this.cachedKey = key;
    this.cachedProvider = MarketDataProviderFactory.createProvider(
      key,
      this.mockProvider,
      this.eodhdProvider,
      this.noneProvider,
    );
    return this.cachedProvider;
  }
}
```

No hardcoded provider names — factory handles all composition.

### 13. `src/modules/market/application/services/market-strategy.resolver.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AdminConfigService } from '../../../admin/application/services/admin-config.service';
import { StrategyFactory } from '../../../common/strategies/strategy.factory';
import { IMarketSimulationStrategy } from '../../../common/strategies/market-simulation-strategy.interface';
import { GBMMarketSimulationStrategy } from '../../../common/strategies/gbm-market-simulation.strategy';
import { FlatMarketSimulationStrategy } from '../../../common/strategies/flat-market-simulation.strategy';
import { NoiseWaveSimulationStrategy } from '../../../common/strategies/nw-simulation.strategy';
import { StrategyType } from '../../../common/strategies/strategy.types';

@Injectable()
export class MarketStrategyResolver {
  private cachedStrategy: IMarketSimulationStrategy | null = null;
  private cachedKey: string | null = null;

  constructor(
    private readonly adminConfigService: AdminConfigService,
    private readonly gbmStrategy: GBMMarketSimulationStrategy,
    private readonly flatStrategy: FlatMarketSimulationStrategy,
    private readonly nwStrategy: NoiseWaveSimulationStrategy,
  ) {}

  async getStrategy(): Promise<IMarketSimulationStrategy> {
    const key = String(
      (await this.adminConfigService.get('SIMULATION_STRATEGY')) ?? 'flat',
    );
    if (this.cachedStrategy && this.cachedKey === key) return this.cachedStrategy;

    this.cachedKey = key;
    this.cachedStrategy = StrategyFactory.createStrategy(
      key as StrategyType,
      this.gbmStrategy,
      this.flatStrategy,
      this.nwStrategy,
    );
    return this.cachedStrategy;
  }
}
```

### 14. `src/modules/currency/application/services/currency-data-provider.resolver.ts`

Same generic pattern as market data provider resolver:
- Reads `'CURRENCY_PROVIDER'`
- Defaults to `'mock'`
- Delegates to `CurrencyProviderFactory.createProvider()`
- Caches by key

### 15. `src/modules/currency/application/services/currency-strategy.resolver.ts`

Same generic pattern as market strategy resolver:
- Reads `'CURRENCY_SIMULATION_STRATEGY'`
- Defaults to `'flat'`
- Delegates to `StrategyFactory.createStrategy()`
- Caches by key

---

## Test Updates

### Factory spec updates (2 files)

**`market-data-provider.factory.spec.ts`**: The `'eodhd'` test changes from expecting `eodhdProvider` directly to expecting a `FallbackMarketDataProvider` instance wrapping eodhd + mock.

**`currency-provider.factory.spec.ts`**: Same pattern for `exchangeRate` → expect `FallbackCurrencyDataProvider`.

### Consumer test updates (7 files)

Each consumer test replaces the direct provider mock with a resolver mock:

```typescript
// Before
provider = { getName: jest.fn(), getQuote: jest.fn() };
service = new MarketRefreshService(stockModel, provider, ...);

// After
provider = { getName: jest.fn(), getQuote: jest.fn() };
resolver = { getProvider: jest.fn().mockResolvedValue(provider) };
service = new MarketRefreshService(stockModel, resolver, ...);
```

### New resolver tests (4 files)

Each resolver test verifies at minimum:
- Returns correct provider/strategy per config key
- Caching returns same instance when key unchanged
- Cache invalidates and recreates on key change
- Falls back to default when config is null

### New e2e test (1 file)

`test/hot-swap.e2e-spec.ts` — verifies runtime switching:
```
✓ starts with none provider (0 stocks seeded)
✓ switches to mock provider and seeds stocks at runtime
✓ switches back to none (stocks remain, no crash)
```

---

## Risk & Scalability

### Adding a new provider (e.g., `'finnhub'`)

1. Create `FinnhubMarketDataProvider` class
2. Add `case 'finnhub':` in `MarketDataProviderFactory` (include `FallbackMarketDataProvider` wrapping if needed)
3. Add to `market.module.ts` providers array
4. **Done** — resolver is unchanged, no hardcoded names anywhere

### Adding a new config-driven feature

1. Create new resolver following the same generic cache-by-key pattern
2. Add resolver to module providers
3. Replace `@Inject('TOKEN')` consumer injections with resolver

### Risk table

| Risk | Mitigation |
|---|---|
| Resolver caches stale provider after config change | Cache invalidates on key mismatch (string compare); next call fetches fresh instance |
| Mid-operation config change leaves in-flight request with old provider | That request keeps its reference; GC collects old instance when all consumers release it |
| DB latency (~5-200ms) on first access | Cached; only first call or call-after-key-change pays this cost |
| `onModuleInit()` in schedulers is synchronous | Make `async` — NestJS supports async lifecycle hooks natively |
| Scheduler cron runs stale schedule after provider swap | `reconcileSchedule()` on every tick removes old cron and registers new one |
| Factory creates new wrapper instance per key change | Lightweight objects; no listeners/subscriptions held by consumers |

---

## Summary

| Metric | Value |
|---|---|
| New files | 4 resolvers + 4 test specs + 1 e2e test |
| Modified files | 7 consumers + 2 modules + 1 admin controller + 2 factory specs + 7 consumer test updates |
| Net lines added | ~160 (code) + ~290 (tests) |
| Hardcoded provider names in resolvers | **Zero** |
| Complexity | Low — each resolver is a simple cache-by-key pattern |
| Risk | Low — changes are mechanical, existing tests validate behavior |

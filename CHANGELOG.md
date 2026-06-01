# Changelog

## [Unreleased]

### Added

- **Currency conversion for multi-currency stock support**
  - LIMIT orders: stock price is converted from native currency to CLP before reserving balance
  - MARKET orders: stock price is converted from native currency to CLP before checking balance and executing
  - Portfolio summary: totals (`investedValue`, `totalEquity`, `unrealizedProfitLoss`) are computed in CLP
  - New portfolio tests covering mixed CLP/USD positions and missing exchange rate tolerance
  - `CurrencyRateService` exported from `CurrencyModule` for cross-module dependency injection

### Changed

- `OrdersService.createOrder` — converts `limitPrice` to CLP when stock currency ≠ CLP before balance reservation
- `OrderExecutionService.executeMarketOrder` — converts `livePrice` to CLP when stock currency ≠ CLP before balance check/deduction
- `OrderExecutionService.executeOrder` — converts market price to CLP for balance operations, keeps native price for position average cost and trade records
- `PortfolioService.getSummary` — per-position values remain in native currency; summary totals are converted to CLP

### Technical

- `processBuyOrder` now receives separate CLP amounts (for balance) and native amounts (for position averaging)
- `processSellOrder` receives CLP amounts for balance addition
- `executeMarketOrder` fetches stock document to determine currency before execution
- `processPendingOrders` propagates currency info from quotes through execution pipeline
- Added in-memory rate cache in `PortfolioService` to avoid duplicate exchange rate lookups per summary

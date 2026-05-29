# Changelog

## 2026-05-29 — Price field contract unification

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

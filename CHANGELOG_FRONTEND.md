# Frontend Changelog — Hot-Swappable Providers

## API Change: `GET /api/admin/config/:key`

Provider and strategy config keys no longer require a server restart. Changes take effect **immediately**.

### Removed fields

The following fields are **no longer included** in the response for any config key:

| Field | Reason |
|---|---|
| `effectiveValue` | All config values now apply immediately; no env var fallback needed |
| `appliesOn` | No config key requires a restart |

### Affected keys

These keys previously returned `appliesOn: 'restart'` — they now apply instantly:

- `MARKET_PROVIDER` — swaps the data provider at runtime
- `SIMULATION_STRATEGY` — swaps the simulation strategy at runtime

## Provider refresh schedules (cron)

Each data provider declares its own refresh schedule. When the active provider is swapped at runtime, the cron job is automatically removed and re-registered with the new provider's schedule.

### Cron expressions

| Provider | Env variable | Default | Notes |
|---|---|---|---|
| EODHD (market) | `EODHD_DAILY_REFRESH_CRON` | `0 30 18 * * 1-5` | Weekdays at 18:30 |
| Mock (market) | `MOCK_DAILY_REFRESH_CRON` | `0 30 18 * * 1-5` | Same default as EODHD |
| ExchangeRate (currency) | `EXCHANGERATE_REFRESH_CRON` | `0 0 * * * *` | Every hour |

All cron expressions are **configurable via environment variables** — the user can set any valid cron string. If a provider has no refresh schedule (e.g., `none-market-data` or `mock-currency` in real-time mode), no cron is registered.

### Frontend action items

1. Remove any "restart required" badge or indicator from the admin config UI
2. Remove any logic that reads `appliesOn` or `effectiveValue` from config responses
3. The `GET /api/admin/config/:key` response is now simply:

```json
{
  "key": "MARKET_PROVIDER",
  "value": "eodhd",
  "name": "Proveedor de datos de mercado",
  "tags": ["market", "provider"],
  "inUse": true,
  "lastUsedAt": "2026-06-12T...",
  "createdAt": "2026-06-12T...",
  "updatedAt": "2026-06-12T..."
}
```

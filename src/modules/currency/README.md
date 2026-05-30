# Currency Module

Módulo de tipo de cambio sintético para pares forex (ej. USDCLP, EURUSD) usando una arquitectura **Anchor + Noise** para minimizar el consumo de APIs externas con rate limits estrictos.

## Arquitectura Two-Tick

### 1. CURRENCY_API_REQ_TICK (Anchor — CronJob)

- Frecuencia: cada 1 hora (configurable via `CURRENCY_API_REQ_TICK`)
- Responsabilidad: obtiene el precio real desde el provider externo y lo almacena como `forex:{symbol}:base_price` en Redis
- También siembra `forex:{symbol}:live_price` al iniciar si no existe
- Ejecutado por `CurrencyAnchorService`

### 2. CURRENCY_RT_TICK (Heartbeat — setInterval)

- Frecuencia: cada 5 segundos (configurable via `CURRENCY_RT_TICK_INTERVAL_SECONDS`)
- Responsabilidad: lee `base_price` y `live_price` de Redis, aplica una estrategia de micro-movimientos (`IMarketSimulationStrategy`) para generar el siguiente precio sintético, lo guarda como `forex:{symbol}:live_price`, y emite un evento al bus
- Ejecutado por `CurrencyTickService`

## Strategy Pattern

La simulación usa la misma interfaz `IMarketSimulationStrategy` que el módulo de acciones, extraída al módulo compartido `CommonStrategiesModule`. Estrategias disponibles:

| Nombre | Clase | Comportamiento |
|---|---|---|
| `flat` | `FlatMarketSimulationStrategy` | Precio constante (sin ruido) |
| `gbm` | `GBMMarketSimulationStrategy` | Movimiento Browniano Geométrico |
| `nw` | `NoiseWaveSimulationStrategy` | Ruido con momentum y onda senoidal |

Selección via `CURRENCY_SIMULATION_STRATEGY` env var.

## Provider System

Los providers implementan `CurrencyDataProvider` y se seleccionan via `CURRENCY_PROVIDER`:

| Provider | Descripción |
|---|---|
| `mock` | Genera tasas sintéticas con ruido aleatorio |
| `external` | Consulta API externa (exchangerate-api / EODHD) |
| `none` | Lanza error (fallback) |

## Redis Key Conventions

| Key | Contenido | Actualizado por |
|---|---|---|
| `forex:{symbol}:base_price` | Precio ancla (real) | `CurrencyAnchorService` |
| `forex:{symbol}:live_price` | Precio sintético (actual) | `CurrencyTickService` |

## Strict Transaction Pricing

Cuando un usuario ejecuta una operación, el `TradingService` **debe** leer `forex:{symbol}:live_price` (no `base_price`) para evitar deslizamiento fantasma.

## Eventos

- `internal.currency.update` — emitido por `CurrencyTickService` con `Array<{ symbol, close, dayChangePercentage }>`
- Escuchado por `RealtimeGateway` que lo reenvía a la sala `forex:{symbol}`

## Environment Variables

| Variable | Default | Descripción |
|---|---|---|
| `CURRENCY_PROVIDER` | `mock` | Proveedor activo |
| `CURRENCY_SYMBOLS` | `USDCLP` | Pares forex separados por coma |
| `CURRENCY_SIMULATION_STRATEGY` | `flat` | Estrategia de simulación |
| `CURRENCY_API_REQ_TICK` | `0 0 * * * *` | Cron para fetch ancla |
| `CURRENCY_RT_TICK_INTERVAL_SECONDS` | `5` | Intervalo entre ticks sintéticos |
| `CURRENCY_ANCHOR_VOLATILITY` | `0.005` | Volatilidad base |
| `CURRENCY_ANCHOR_DRIFT` | `0` | Deriva base |
| `CURRENCY_API_KEY` | — | API key del provider externo |

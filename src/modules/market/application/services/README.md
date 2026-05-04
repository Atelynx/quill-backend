# Servicios de mercado

Esta carpeta contiene casos de uso del modulo `market`.

- `MarketService`: fachada de consultas REST y delegacion de refresh.
- `MarketSeedService`: siembra inicial del catalogo y snapshots base.
- `MarketRefreshService`: orquesta refresh operativo y refresh externo autorizado.
- `MarketSnapshotService`: busca snapshots recientes y los adapta a cotizaciones.
- `MarketUpdateWriterService`: persiste precios, snapshots y cache.
- `EodhdDailyRefreshScheduler`: registra el cron diario de EODHD si esta habilitado.

Los servicios se conectan con esquemas de MongoDB, providers de mercado,
`CacheService` y `MarketGateway`. El refresh frecuente usado por ordenes no llama
a EODHD; solo el scheduler diario puede hacerlo con `allowExternalFetch=true`.

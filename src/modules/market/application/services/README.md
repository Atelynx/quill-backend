# Servicios de mercado

Esta carpeta contiene casos de uso del modulo `market`.

- `MarketService`: fachada de consultas REST y delegacion de refresh.
- `MarketSeedService`: siembra inicial del catalogo usando `getSeedData()` del provider activo.
- `MarketRefreshService`: orquesta refresh de mercado delegando todo al provider. Provider-agnostico.
- `MarketSnapshotService`: busca snapshots recientes y los adapta a cotizaciones.
- `MarketUpdateWriterService`: persiste precios, snapshots y cache.
- `MarketRefreshScheduler`: registra cron de refresh solo si el provider declara `getRefreshSchedule()`.

Los servicios son provider-agnosticos. Cada provider maneja su propio cacheo,
llamadas a API externa, y estrategia de fallback internamente.

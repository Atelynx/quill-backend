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

El precio vivo ejecutable se almacena en `stock:{symbol}:live_price`. Las
órdenes LIMIT lo priorizan y usan el cierre persistido solo como fallback
explícito cuando el precio vivo no está disponible o no es válido.

El calendario bursátil usa la zona `America/Santiago` y bloquea sábados y
domingos. Los feriados bursátiles no se modelan actualmente.

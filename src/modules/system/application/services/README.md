# Servicios de sistema

Esta carpeta contiene servicios transversales del modulo `system`.

- `CacheService`: store compatible con `cache-manager`; usa Redis si responde y
  cae a memoria si Redis no esta disponible.
- `HealthService`: reporta estado operativo de MongoDB y cache.

`CacheService` es usado por el modulo de mercado para guardar cotizaciones con
TTL y evitar trabajo repetido cuando hay snapshots recientes.

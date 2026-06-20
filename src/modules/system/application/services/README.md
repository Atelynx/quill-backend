# Servicios de sistema

Esta carpeta contiene servicios transversales del modulo `system`.

- `CacheService`: store compatible con `cache-manager`; requiere Redis en
  produccion y solo permite fallback local bounded en desarrollo y tests.
- `HealthService`: reporta estado operativo de MongoDB y cache.

`CacheService` es usado por el modulo de mercado para guardar cotizaciones con
TTL y evitar trabajo repetido cuando hay snapshots recientes.

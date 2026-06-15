# Cache compartida

Esta carpeta implementa el store de cache usado por `cache-manager`.

- `cache.service.ts`: conecta con Redis y expone operaciones de cache.
- `cache-fallback-policy.ts`: permite fallback local solo fuera de producción.
- `create-redis-client.ts`: centraliza opciones de conexión y errores de Redis.
- `bounded-memory-cache.ts`: mantiene el fallback local limitado y con TTL.
- Los archivos `*.spec.ts` verifican serialización, límites y política por
  entorno.

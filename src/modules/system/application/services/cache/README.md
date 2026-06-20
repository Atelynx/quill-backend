# Cache compartida

Esta carpeta implementa el store de cache usado por `cache-manager`.

- `cache.service.ts`: conecta con Redis y expone operaciones de cache.
- `cache-fallback-policy.ts`: permite fallback local solo fuera de producción.
- `cache-lock.ts`: implementa locks con `SET NX PX` y liberación segura por owner.
- `create-redis-client.ts`: centraliza opciones de conexión y errores de Redis.
- `bounded-memory-cache.ts`: mantiene el fallback local limitado y con TTL.
- Los archivos `*.spec.ts` verifican serialización, límites y política por
  entorno.

`reset()` limpia únicamente la base Redis seleccionada mediante `FLUSHDB`; no
usa `FLUSHALL` para evitar borrar bases pertenecientes a otras aplicaciones.

Los locks distribuidos requieren Redis en producción. Desarrollo y tests usan
el fallback local con TTL para mantener ejecuciones deterministas.

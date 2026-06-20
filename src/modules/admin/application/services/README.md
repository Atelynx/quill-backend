# Servicios de administración

- `admin-config.service.ts` persiste configuraciones versionadas, snapshots y
  restauraciones transaccionales.
- `admin-config-value.validation.ts` valida las claves financieras y operativas
  conocidas antes de persistirlas.
- Los archivos `*.spec.ts` cubren reglas de validación y comportamiento de los
  servicios.

Los controladores administrativos consumen estos servicios y los módulos de
órdenes, mercado y usuarios leen la configuración activa.

Las escrituras mantienen una única versión activa por clave mediante un índice
único parcial. La restauración valida el snapshot completo antes de reemplazar
atómicamente el conjunto de configuraciones activas.

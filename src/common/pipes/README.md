# Pipes compartidos

- `ParseLimitPipe` convierte y limita parámetros de paginación antes de llegar a
  servicios que consultan MongoDB.
- `ParseObjectIdPipe` valida identificadores MongoDB y responde `400` antes de
  que Mongoose intente convertirlos.
- `pipes.spec.ts` cubre valores válidos, defaults y rechazos.

Los controladores importan estos pipes directamente para mantener la validación
en la capa HTTP.

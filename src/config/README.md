# Configuracion

Esta carpeta centraliza utilidades de entorno.

- `env.validation.ts`: esquema Joi de variables obligatorias y defaults.
- `env-file-paths.ts`: resolucion de archivos `.env`.
- `normalize-mongodb-uri.ts`: normalizacion de URI MongoDB para ejecucion local.

`MARKET_PROVIDER=eodhd` exige `EODHD_API_KEY`; `MARKET_PROVIDER=mock` no la
requiere. Los valores sensibles deben vivir solo en `.env` local o variables del
entorno de despliegue.

`SWAGGER_ENABLED` se habilita por defecto fuera de producción. En producción su
valor por defecto es `false` y debe activarse explícitamente.

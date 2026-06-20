# Configuración de infraestructura de autenticación

Esta carpeta contiene factories de configuración usadas por el módulo de
autenticación.

- `auth-throttler.config.ts`: configura límites de autenticación con storage
  Redis compartido en producción y storage en memoria en desarrollo o tests.
- `auth-throttler.config.spec.ts`: verifica la selección de storage por entorno
  y el fallo explícito cuando falta la URL de Redis en producción.

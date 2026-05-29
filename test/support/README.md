# Soporte de pruebas

Esta carpeta contiene utilidades compartidas para pruebas e2e.

## Archivos

- `test-app.ts`: crea y destruye una aplicacion NestJS de prueba con MongoDB
  en memoria, configuracion local y Redis en fallback.
- `order-financial-fixtures.ts`: centraliza fixtures controlados para pruebas
  financieras de ordenes, incluyendo creacion de usuarios autenticados,
  acciones locales y posiciones.

Estas utilidades se conectan con los modulos reales del backend mediante los
modelos de Mongoose y evitan depender de proveedores externos o credenciales.

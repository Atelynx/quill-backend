# Arquitectura MVP de Quill

## Objetivo

Construir un MVP profesional de Quill como una plataforma web educativa para simulación de compra y venta de acciones con capital ficticio, priorizando mantenibilidad, claridad de diseño y capacidad de evolución.

## Enfoque general

Se implementará un monorepo con dos aplicaciones principales y un paquete compartido:

- `apps/backend`: API y lógica de negocio con NestJS
- `apps/frontend`: cliente web responsive con React + Vite
- `packages/shared`: tipos, contratos y utilidades compartidas entre frontend y backend

Esta estructura permite separar responsabilidades sin introducir complejidad innecesaria.

## Arquitectura backend

El backend seguirá un monolito modular con separación por capas dentro de cada módulo funcional:

- `domain`: entidades, value objects, enums, reglas del negocio e interfaces de repositorio
- `application`: casos de uso, servicios de aplicación y DTOs internos
- `infrastructure`: persistencia MongoDB, caché Redis, adaptadores externos y configuración
- `presentation`: controladores REST, gateways y DTOs de entrada/salida

### Módulos funcionales

- `auth`: registro, login, JWT, hashing de contraseñas
- `users`: perfil básico, saldo inicial ficticio y lectura del usuario autenticado
- `market`: catálogo de acciones, precios actuales, snapshots históricos y proveedor de mercado
- `orders`: creación y consulta de órdenes limitadas de compra y venta
- `portfolio`: posiciones del usuario, métricas del portafolio y resumen del dashboard
- `trades`: historial de operaciones ejecutadas
- `system`: healthcheck, configuración, seeds y utilidades transversales

### Reglas de negocio principales

- Cada usuario comienza con un saldo ficticio configurable por entorno.
- Las órdenes se crean como `BUY_LIMIT` o `SELL_LIMIT`.
- Una orden de compra se ejecuta cuando el precio de mercado es menor o igual al precio límite.
- Una orden de venta se ejecuta cuando el precio de mercado es mayor o igual al precio límite.
- Cada ejecución genera una operación histórica y aplica comisión.
- Las posiciones del portafolio se actualizan de forma transaccional.

### Persistencia

MongoDB será la base principal para:

- usuarios
- acciones
- órdenes
- operaciones ejecutadas
- posiciones
- snapshots de precio

Redis se usará para:

- precio más reciente por símbolo
- caché breve de listados de mercado
- soporte a difusión de precios en tiempo real

### Fuente de datos de mercado

Para que el proyecto sea ejecutable sin dependencias externas obligatorias, el sistema usará una abstracción `MarketDataProvider`.

Implementaciones previstas:

- `mock`: proveedor por defecto para el MVP, con acciones semilla y variación controlada de precios
- `other`: integración futura mediante variables de entorno, sin acoplar la lógica de negocio al proveedor externo

Esta decisión evita bloquear el desarrollo por credenciales o límites de una API externa, pero deja el sistema preparado para conectarse a una fuente real.

### Flujo de actualización de mercado

1. Un proceso programado actualiza precios periódicamente.
2. El backend guarda el nuevo snapshot.
3. Se actualiza Redis con el último precio por símbolo.
4. Se revisan órdenes pendientes para ejecutar las que cumplan condición.
5. Se emiten eventos de mercado para el frontend.

## Arquitectura frontend

El frontend usará React + Vite + TypeScript con organización por funcionalidades:

- `app`: bootstrap, router, providers globales
- `modules/auth`
- `modules/dashboard`
- `modules/market`
- `modules/orders`
- `modules/portfolio`
- `modules/trades`
- `shared`: componentes reutilizables, hooks, cliente HTTP, utilidades y estilos globales

### Decisiones de interfaz

- Aplicación SPA responsive con enfoque mobile-first
- Autenticación persistida por token JWT
- Dashboard con resumen financiero, portafolio, mercado y actividad reciente
- Formularios con validación en cliente y manejo claro de errores
- Gráficos para evolución del portafolio y precios

## Contratos iniciales del dominio

### Usuario

- id
- nombre
- email
- passwordHash
- saldoDisponible
- saldoReservado
- creadoEn

### Acción

- símbolo
- nombre
- sector
- moneda
- precioActual
- variaciónDiaria

### Orden

- id
- userId
- symbol
- side
- quantity
- limitPrice
- status
- commissionAmount
- createdAt
- executedAt

### Operación ejecutada

- id
- userId
- orderId
- symbol
- side
- quantity
- executionPrice
- grossAmount
- commissionAmount
- netAmount
- executedAt

### Posición

- id
- userId
- symbol
- quantity
- averageCost
- updatedAt

## Seguridad base

- variables de entorno para secretos y configuración
- JWT con expiración
- contraseñas con hash `bcrypt`
- validación de input en backend y frontend
- respuestas de error consistentes
- CORS configurado de forma explícita
- datos sensibles fuera del repositorio

## Decisiones técnicas del MVP

- Se prioriza REST para operaciones de negocio críticas.
- Se usarán eventos en tiempo real solo para precios y refresco del mercado.
- No se implementará administración avanzada en esta primera versión.
- La comisión será configurable por entorno para evitar lógica rígida.
- El cálculo del portafolio combinará posiciones persistidas con el último precio disponible.

## Estructura objetivo del repositorio

```text
.
|-- apps
|   |-- backend
|   `-- frontend
|-- docs
|   |-- architecture.md
|   `-- project-brief.md
|-- packages
|   `-- shared
|-- .env.example
|-- docker-compose.yml
|-- package.json
`-- README.md
```

## Riesgos controlados

- Dependencia de datos externos: mitigada con proveedor `mock`
- Inconsistencias en órdenes: mitigadas con transacciones de MongoDB
- Crecimiento de complejidad: mitigado con módulos y capas separadas
- Falta de tiempo para extras: se prioriza un MVP completo antes de mejoras opcionales

## Mejoras futuras fuera del MVP

- watchlists
- alertas de precio
- stop loss y take profit
- ranking o gamificación más profunda
- panel administrativo
- integración completa con proveedor externo en tiempo real
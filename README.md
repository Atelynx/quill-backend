# Quill

Quill es una plataforma educativa para simular compra y venta de acciones con capital ficticio. Su objetivo es ayudar a estudiantes y personas que recién comienzan a entender cómo funciona un portafolio, cómo impactan las órdenes límite y cómo cambian sus decisiones cuando el mercado se mueve.

Este repositorio contiene el MVP funcional desarrollado por Atelynx como un monolito modular con frontend y backend separados, listo para presentación académica, portafolio o demo técnica.

## Autores

Equipo desarrollador: Atelynx

- Ferran Rojas
- Maximo Sarno
- Benjamín Cuello

## Tecnologías

### Frontend

- React
- Vite
- TypeScript
- React Query
- React Hook Form
- Recharts
- Socket.IO Client

### Backend

- NestJS
- TypeScript
- MongoDB con Mongoose
- Redis con fallback local en memoria
- JWT para autenticación
- Scheduler para actualización de mercado y ejecución de órdenes
- WebSockets para difusión de precios

## Qué resuelve el MVP

- Registro e inicio de sesión
- Registro con confirmación manual de acceso tras crear la cuenta
- Saldo inicial ficticio configurable por entorno
- Catálogo de acciones con precios dinámicos
- Historial de precios por acción
- Órdenes limitadas de compra y venta
- Reserva de saldo para compras y reserva de posiciones para ventas
- Ejecución automática cuando el precio cumple la condición
- Cálculo de comisión configurable
- Visualización de portafolio, órdenes abiertas y operaciones recientes
- Dashboard responsive con métricas y gráficos
- Tema claro y oscuro con cambio visible en la interfaz

## Decisiones técnicas principales

- Monolito modular: simplifica despliegue y desarrollo del MVP sin cerrar el camino a una futura separación por servicios.
- Capas por módulo en backend: `domain`, `application`, `infrastructure` y `presentation`.
- Proveedor de mercado desacoplado: el sistema usa un proveedor `mock` por defecto para que el proyecto sea ejecutable sin credenciales externas.
- Persistencia transaccional: la ejecución de órdenes actualiza usuario, posición, orden y operación dentro de una transacción de MongoDB.
- Cache pragmática: Redis se usa cuando está disponible; si no lo está, el sistema cae a un fallback en memoria para no bloquear la demo.

Más detalle en:

- [Arquitectura](./docs/architecture.md)
- [Backend docs](./docs/backend/README.md)
 

## Estructura del repositorio

```text
.
|-- src/                    # Backend source code
|   |-- common/             # Utilities, guards, filters, decorators
|   |-- config/             # Environment and configuration
|   `-- modules/            # Functional modules
|-- docs/                   # Documentation
|-- test/                   # E2E tests
|-- .env.example
|-- docker-compose.yml
`-- package.json
```

## Estructura técnica resumida

### Backend

```text
src/
|-- common/                 # Decorators, guards, filters, interfaces
|-- config/                 # Environment validation
`-- modules/
    |-- auth/               # User authentication
    |-- users/              # User management
    |-- market/             # Stock data & pricing
    |-- orders/             # Order creation & execution
    |-- portfolio/          # User positions & metrics
    |-- trades/             # Trade history
    `-- system/             # Health check & cache
```

## Variables de entorno

Copia `.env.example` como `.env` en la raíz del proyecto y ajusta lo necesario.

Variables principales:

- `BACKEND_PORT`
- `FRONTEND_ORIGIN`
- `MONGODB_URI`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `INITIAL_BALANCE`
- `COMMISSION_RATE`
- `MARKET_PROVIDER`
- `MARKET_TICK_INTERVAL_SECONDS`

Cadena local recomendada para MongoDB:

```bash
MONGODB_URI=mongodb://localhost:27017/quill?replicaSet=rs0
```

## Cómo ejecutar el proyecto

### 1. Instalar dependencias

```bash
npm install
```

### 2. Levantar servicios de infraestructura

```bash
docker compose up -d
```

Esto inicia:

- MongoDB en `mongodb://localhost:27017` con replica set `rs0`
- Redis en `redis://localhost:6379`

Si ya habÃ­as levantado una instancia anterior de MongoDB sin replica set y notas errores de transacciones, reinicia la infraestructura con:

```bash
docker compose down -v
docker compose up -d
```

### 3. Configurar entorno

```bash
copy .env.example .env
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

URLs por defecto:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000/api`
- Healthcheck: `http://localhost:3000/api/system/health`

## Scripts útiles

### Raíz

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm test`
- `npm run test:e2e`
- `npm run test:backend`
- `npm run test:frontend`

### Backend

- `npm run start:dev --prefix apps/backend`
- `npm run build --prefix apps/backend`
- `npm run lint --prefix apps/backend`
- `npm run test --prefix apps/backend`
- `npm run test:e2e --prefix apps/backend`

### Frontend

- `npm run dev --prefix apps/frontend`
- `npm run build --prefix apps/frontend`
- `npm run lint --prefix apps/frontend`
- `npm run test --prefix apps/frontend`

## Estrategia de testing

Quill incluye una capa de pruebas centrada en comportamiento y reglas criticas, sin llenar el repositorio de casos superficiales.

- Backend unitario con Jest para servicios de autenticación, órdenes, comisiones y portafolio.
- Frontend con Vitest y Testing Library para formularios, tema y estados vacíos.
- E2E de API con Supertest y MongoDB en memoria para validar salud del sistema, registro, login y flujo básico de creación y ejecución de órdenes.

Se dejó fuera, por ahora, una suite e2e de navegador completa. En esta etapa aporta mejor señal cubrir la API real y los componentes clave de interfaz con pruebas más rápidas, estables y mantenibles.

## Estado actual del MVP

El proyecto ya incluye el flujo principal completo:

1. Un usuario se registra o inicia sesión.
2. Tras registrarse, vuelve al login e inicia sesión manualmente.
3. Recibe saldo ficticio inicial.
4. Consulta acciones y su historial reciente.
5. Crea órdenes de compra o venta con precio límite.
6. El backend actualiza precios periódicamente.
7. Si el precio cumple la condición, la orden se ejecuta.
8. El sistema registra la operación, aplica comisión y actualiza el portafolio.
9. El dashboard refleja saldo, posiciones, órdenes abiertas y operaciones recientes.

## Limitaciones conscientes del MVP

- El proveedor de mercado por defecto es simulado, no una integración en vivo con broker real.
- No hay panel administrativo.
- No se incluyeron alertas, watchlists, stop loss ni take profit.
- La app está pensada primero como web responsive; una capa móvil nativa queda como siguiente evolución.

## Mejoras futuras

- Integración completa un proveedor real
- Cancelación de órdenes abiertas
- Watchlists y alertas
- Panel administrativo para comisiones y parámetros del simulador
- Métricas históricas más profundas del portafolio
- Adaptación híbrida con Capacitor
- Migrar de App router a Routes handlers

## Validación realizada

Se validó el repositorio con los siguientes comandos:

- `npm run build`
- `npm run lint`
- `npm test`
- `npm run test:e2e`

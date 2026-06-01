# Quill

Plataforma educativa para simular compra y venta de acciones con capital ficticio. Ayuda a estudiantes y principiantes a entender portafolios, órdenes límite y dinámica del mercado.

## Stack

- **Frontend**: React, Vite, TypeScript, React Query, Recharts, Socket.IO Client
- **Backend**: NestJS, TypeScript, MongoDB + Mongoose, Redis (fallback en memoria), JWT, Socket.IO

## Empezar

```bash
npm install
docker compose up -d          # MongoDB + Redis
cp .env.example .env
npm run dev                   # Backend :3000, Frontend :5173
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo |
| `npm run build` | Build |
| `npm test` | Tests unitarios |
| `npm run test:e2e` | Tests e2e |
| `npm run lint` | Linter |

## Variables de entorno principales

| Variable | Descripción |
|----------|-------------|
| `MONGODB_URI` | Conexión MongoDB (requiere replica set) |
| `JWT_SECRET` | Secreto JWT |
| `INITIAL_BALANCE` | Saldo ficticio inicial |
| `COMMISSION_RATE` | Tasa de comisión |
| `MARKET_PROVIDER` | `mock` (default) o `eodhd` |

Ver `.env.example` para lista completa.

## Documentación

- [Arquitectura](./docs/architecture.md)
- [Backend](./docs/backend/README.md)
- [Flujo de datos](./docs/flow.md)

## Funcionalidades

- Registro/login con JWT
- Catálogo de acciones con precios dinámicos
- Órdenes límite de compra y venta
- Ejecución automática al cumplirse la condición
- Portafolio, órdenes abiertas y operaciones recientes
- WebSockets en tiempo real
- Tema claro/oscuro

## Limitaciones (MVP)

- Proveedor de mercado simulado por defecto (sin broker real)
- Sin panel administrativo, alertas, watchlists, stop loss/take profit
- Web responsive sin capa móvil nativa

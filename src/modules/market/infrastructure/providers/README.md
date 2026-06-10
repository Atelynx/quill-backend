# Providers de mercado

Esta carpeta contiene adaptadores de datos externos o simulados para el contrato
`MarketDataProvider`.

- `market-data-provider.interface.ts`: contrato comun. Cada provider maneja su propio cacheo, scheduling, y seed data.
- `mock-market-data.provider.ts`: generador local con algoritmo de momentum para desarrollo y tests.
- `eodhd-market-data.provider.ts`: cliente HTTP de EODHD con cache de snapshots integrado y scheduling diario controlado por `EODHD_DAILY_REFRESH_ENABLED`.
- `eodhd-quote.mapper.ts`: normaliza respuestas EODHD al modelo interno.
- `provider.factory.ts`: selecciona el provider segun `MARKET_PROVIDER`.

Para agregar un nuevo provider:
1. Implementar `MarketDataProvider`
2. Registrar en `provider.factory.ts`
3. Configurar la variable de entorno `MARKET_PROVIDER`

No se requieren cambios en los servicios.

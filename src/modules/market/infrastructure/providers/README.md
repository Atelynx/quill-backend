# Providers de mercado

Esta carpeta contiene adaptadores de datos externos o simulados para el contrato
`MarketDataProvider`.

- `market-data-provider.interface.ts`: contrato comun para obtener cotizaciones.
- `mock-market-data.provider.ts`: generador local para desarrollo y tests.
- `eodhd-market-data.provider.ts`: cliente HTTP de EODHD con API key por entorno.
- `eodhd-quote.mapper.ts`: normaliza respuestas EODHD al modelo interno.
- `provider.factory.ts`: selecciona el provider segun `MARKET_PROVIDER`.

Las API keys no se hardcodean ni se imprimen. Los tests mockean HTTP y no usan
credenciales reales.

import { CurrencyDataProvider } from '../../domain/interfaces/currency-data-provider.interface';
import { ExchangeRateCurrencyDataProvider } from './exchangeRate-currency-data.provider';
import { MockCurrencyDataProvider } from './mock-currency-data.provider';
import { NoneCurrencyDataProvider } from './none-currency-data.provider';

export class ProviderFactory {
  static createProvider(
    providerName: string | undefined,
    mockProvider: MockCurrencyDataProvider,
    exchangeRate: ExchangeRateCurrencyDataProvider,
    noneProvider: NoneCurrencyDataProvider,
  ): CurrencyDataProvider {
    const normalizedName = providerName?.trim();

    switch (normalizedName) {
      case 'mock':
        return mockProvider;
      case 'exchangeRate':
        return exchangeRate;
      case 'none':
      case '':
      case undefined:
        return noneProvider;
      default:
        throw new Error(
          `Unknown currency provider: "${providerName}". Valid options: "mock", "exchangeRate"`,
        );
    }
  }
}

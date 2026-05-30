import { CurrencyDataProvider } from '../../domain/interfaces/currency-data-provider.interface';
import { ExternalCurrencyDataProvider } from './external-currency-data.provider';
import { MockCurrencyDataProvider } from './mock-currency-data.provider';
import { NoneCurrencyDataProvider } from './none-currency-data.provider';

export class ProviderFactory {
  static createProvider(
    providerName: string | undefined,
    mockProvider: MockCurrencyDataProvider,
    externalProvider: ExternalCurrencyDataProvider,
    noneProvider: NoneCurrencyDataProvider,
  ): CurrencyDataProvider {
    const normalizedName = providerName?.toLowerCase().trim();

    switch (normalizedName) {
      case 'mock':
        return mockProvider;
      case 'external':
        return externalProvider;
      case 'none':
      case '':
      case undefined:
        return noneProvider;
      default:
        throw new Error(
          `Unknown currency provider: "${providerName}". Valid options: "mock", "external"`,
        );
    }
  }
}

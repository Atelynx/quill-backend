import { MarketDataProvider } from './market-data-provider.interface';
import { EodhdMarketDataProvider } from './eodhd-market-data.provider';
import { MockMarketDataProvider } from './mock-market-data.provider';

/**
 * Factory for creating provider instances based on configuration.
 * Supports dynamic provider selection at runtime.
 */
export class ProviderFactory {
  /**
   * Create a provider instance based on provider name.
   *
   * @param providerName - 'mock' | 'eodhd'
   * @param mockProvider - Injected MockMarketDataProvider instance
   * @param eodhdProvider - Injected EodhdMarketDataProvider instance
   * @returns MarketDataProvider instance ready to use
   * @throws Error if provider name is invalid
   */
  static createProvider(
    providerName: string,
    mockProvider: MockMarketDataProvider,
    eodhdProvider: EodhdMarketDataProvider,
  ): MarketDataProvider {
    const normalizedName = providerName.toLowerCase().trim();

    switch (normalizedName) {
      case 'mock':
        return mockProvider;
      case 'eodhd':
        return eodhdProvider;
      default:
        throw new Error(
          `Unknown market provider: "${providerName}". Valid options: "mock", "eodhd"`,
        );
    }
  }
}

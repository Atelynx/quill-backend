import { MarketDataProvider } from './market-data-provider.interface';
import { MockMarketDataProvider } from './mock-market-data.provider';

/**
 * Factory for creating provider instances based on configuration.
 * Supports dynamic provider selection at runtime.
 */
export class ProviderFactory {
  /**
   * Create a provider instance based on provider name.
   *
   * @param providerName - 'mock' | other providers
   * @param mockProvider - Injected MockMarketDataProvider instance
   * @returns MarketDataProvider instance ready to use
   * @throws Error if provider name is invalid
   */
  static createProvider(
    providerName: string,
    mockProvider: MockMarketDataProvider,
  ): MarketDataProvider {
    const normalizedName = providerName.toLowerCase().trim();

    switch (normalizedName) {
      case 'mock':
        return mockProvider;
      default:
        throw new Error(
          `Unknown market provider: "${providerName}". Valid options: "mock"`,
        );
    }
  }
}

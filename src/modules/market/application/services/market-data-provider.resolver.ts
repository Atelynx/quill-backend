import { Injectable } from '@nestjs/common';
import { AdminConfigService } from '../../../admin/application/services/admin-config.service';
import { MarketDataProviderFactory } from '../../infrastructure/providers/market-data-provider.factory';
import { MarketDataProvider } from '../../infrastructure/providers/market-data-provider.interface';
import { MockMarketDataProvider } from '../../infrastructure/providers/mock-market-data.provider';
import { EodhdMarketDataProvider } from '../../infrastructure/providers/eodhd-market-data.provider';
import { NoneMarketDataProvider } from '../../infrastructure/providers/none-market-data.provider';

@Injectable()
export class MarketDataProviderResolver {
  private cachedProvider: MarketDataProvider | null = null;
  private cachedKey: string | null = null;

  constructor(
    private readonly adminConfigService: AdminConfigService,
    private readonly mockProvider: MockMarketDataProvider,
    private readonly eodhdProvider: EodhdMarketDataProvider,
    private readonly noneProvider: NoneMarketDataProvider,
  ) {}

  async getProvider(): Promise<MarketDataProvider> {
    const key = String(
      (await this.adminConfigService.get('MARKET_PROVIDER')) ?? 'mock',
    );
    if (this.cachedProvider && this.cachedKey === key) return this.cachedProvider;

    const provider = MarketDataProviderFactory.createProvider(
      key,
      this.mockProvider,
      this.eodhdProvider,
      this.noneProvider,
    );
    this.cachedKey = key;
    this.cachedProvider = provider;
    return this.cachedProvider;
  }
}

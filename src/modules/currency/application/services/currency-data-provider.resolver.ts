import { Injectable, Logger } from '@nestjs/common';
import { AdminConfigService } from '../../../admin/application/services/admin-config.service';
import { CurrencyProviderFactory } from '../../infrastructure/providers/currency-provider.factory';
import { CurrencyDataProvider } from '../../domain/interfaces/currency-data-provider.interface';
import { MockCurrencyDataProvider } from '../../infrastructure/providers/mock-currency-data.provider';
import { ExchangeRateCurrencyDataProvider } from '../../infrastructure/providers/exchangeRate-currency-data.provider';
import { NoneCurrencyDataProvider } from '../../infrastructure/providers/none-currency-data.provider';

@Injectable()
export class CurrencyDataProviderResolver {
  private readonly logger = new Logger(CurrencyDataProviderResolver.name);
  private cachedProvider: CurrencyDataProvider | null = null;
  private cachedKey: string | null = null;

  constructor(
    private readonly adminConfigService: AdminConfigService,
    private readonly mockProvider: MockCurrencyDataProvider,
    private readonly exchangeRateProvider: ExchangeRateCurrencyDataProvider,
    private readonly noneProvider: NoneCurrencyDataProvider,
  ) {}

  async getProvider(): Promise<CurrencyDataProvider> {
    const key = String(
      (await this.adminConfigService.get('CURRENCY_PROVIDER')) ?? 'mock',
    );
    if (this.cachedProvider && this.cachedKey === key) return this.cachedProvider;

    const provider = CurrencyProviderFactory.createProvider(
      key,
      this.mockProvider,
      this.exchangeRateProvider,
      this.noneProvider,
    );
    this.logger.log(
      `Currency provider swapped: ${this.cachedKey ?? '(none)'} → ${key}, active: ${provider.getName()}`,
    );
    this.cachedKey = key;
    this.cachedProvider = provider;
    return this.cachedProvider;
  }
}

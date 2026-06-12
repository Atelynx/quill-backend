import { Injectable } from '@nestjs/common';
import { AdminConfigService } from '../../../admin/application/services/admin-config.service';
import { StrategyFactory } from '../../../common/strategies/strategy.factory';
import { IMarketSimulationStrategy } from '../../../common/strategies/market-simulation-strategy.interface';
import { GBMMarketSimulationStrategy } from '../../../common/strategies/gbm-market-simulation.strategy';
import { FlatMarketSimulationStrategy } from '../../../common/strategies/flat-market-simulation.strategy';
import { NoiseWaveSimulationStrategy } from '../../../common/strategies/nw-simulation.strategy';
import { StrategyType } from '../../../common/strategies/strategy.types';

@Injectable()
export class CurrencyStrategyResolver {
  private cachedStrategy: IMarketSimulationStrategy | null = null;
  private cachedKey: string | null = null;

  constructor(
    private readonly adminConfigService: AdminConfigService,
    private readonly gbmStrategy: GBMMarketSimulationStrategy,
    private readonly flatStrategy: FlatMarketSimulationStrategy,
    private readonly nwStrategy: NoiseWaveSimulationStrategy,
  ) {}

  async getStrategy(): Promise<IMarketSimulationStrategy> {
    const key = String(
      (await this.adminConfigService.get('CURRENCY_SIMULATION_STRATEGY')) ?? 'flat',
    );
    if (this.cachedStrategy && this.cachedKey === key) return this.cachedStrategy;

    const strategy = StrategyFactory.createStrategy(
      key as StrategyType,
      this.gbmStrategy,
      this.flatStrategy,
      this.nwStrategy,
    );
    this.cachedKey = key;
    this.cachedStrategy = strategy;
    return this.cachedStrategy;
  }
}

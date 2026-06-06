import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { MarketTickService } from './market-tick.service';

@Injectable()
export class MarketTickScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketTickScheduler.name);
  private readonly jobName = 'market-tick';

  constructor(
    private readonly configService: ConfigService,
    private readonly marketTickService: MarketTickService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const intervalSeconds = this.configService.get<number>(
      'MARKET_TICK_INTERVAL_SECONDS',
      0,
    );

    if (intervalSeconds <= 0) {
      this.logger.log(
        'Market tick simulation is disabled (MARKET_TICK_INTERVAL_SECONDS <= 0).',
      );
      return;
    }

    const interval = setInterval(
      () => void this.runTick(),
      intervalSeconds * 1000,
    );
    this.schedulerRegistry.addInterval(this.jobName, interval);
    this.logger.log(
      `Market tick simulation scheduled every ${intervalSeconds} seconds.`,
    );
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', this.jobName)) {
      this.schedulerRegistry.deleteInterval(this.jobName);
    }
  }

  private async runTick(): Promise<void> {
    try {
      await this.marketTickService.processTick();
    } catch (error) {
      this.logger.error(`Market tick failed: ${this.errorMessage(error)}`);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
  }
}

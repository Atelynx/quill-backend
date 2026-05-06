import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { MarketService } from './market.service';
import { MarketSnapshotService } from './market-snapshot.service';
import { Stock, StockDocument } from '../../infrastructure/schemas/stock.schema';
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from '../../infrastructure/schemas/price-snapshot.schema';

@Injectable()
export class EodhdDailyRefreshScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EodhdDailyRefreshScheduler.name);
  private readonly jobName = 'eodhd-daily-market-refresh';

  constructor(
    @InjectModel(Stock.name) private readonly stockModel: Model<StockDocument>,
    @InjectModel(PriceSnapshot.name)
    private readonly snapshotModel: Model<PriceSnapshotDocument>,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly marketService: MarketService,
    private readonly snapshotService: MarketSnapshotService,
  ) {}

  onModuleInit(): void {
    if (!this.shouldRegisterJob()) {
      return;
    }

    const cronExpression = this.configService.get<string>(
      'EODHD_DAILY_REFRESH_CRON',
      '0 30 18 * * 1-5',
    );
    const job = new CronJob(cronExpression, () => void this.runRefresh());

    this.schedulerRegistry.addCronJob(this.jobName, job);
    job.start();
    this.logger.log('Refresh diario EODHD programado.');

    void this.checkAndRunInitialRefresh();
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('cron', this.jobName)) {
      this.schedulerRegistry.deleteCronJob(this.jobName);
    }
  }

  private shouldRegisterJob(): boolean {
    const provider = this.configService.get<string>('MARKET_PROVIDER');
    const enabled = this.configService.get<boolean>(
      'EODHD_DAILY_REFRESH_ENABLED',
      true,
    );

    return provider?.toLowerCase() === 'eodhd' && enabled;
  }

  private async runRefresh(): Promise<void> {
    this.logger.log('Ejecutando refresh EODHD con allowExternalFetch=true...');
    try {
      await this.marketService.refreshMarket({ allowExternalFetch: true });
      this.logger.log('Refresh EODHD completado exitosamente.');
    } catch (error) {
      this.logger.error(
        `No se pudo ejecutar refresh diario EODHD: ${this.errorMessage(error)}`,
      );
    }
  }

  private async checkAndRunInitialRefresh(): Promise<void> {
    const stocks = await this.stockModel.find().lean().exec();

    if (!stocks.length) {
      this.logger.log(
        'Base de datos vacia, sin registros de acciones. Ejecutando captura inicial EODHD...',
      );
      await this.runRefresh();
      return;
    }

    const todaysMap = await this.snapshotService.getLatestMap(stocks, {
      from: this.today(),
      source: 'eodhd',
    });

    if (todaysMap.size === 0) {
      this.logger.log(
        `Sin snapshot de hoy para ${stocks.length} simbolos. Ejecutando captura inicial EODHD...`,
      );
      await this.runRefresh();
    } else {
      this.logger.log(
        `Datos frescos encontrados (${todaysMap.size}/${stocks.length} con snapshot de hoy). Omitiendo captura inicial para proteger cuota API.`,
      );
    }
  }

  private today(): Date {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'error desconocido';
  }
}

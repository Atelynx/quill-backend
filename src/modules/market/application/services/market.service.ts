import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PRICE_UPDATE_EVENT } from '../../domain/constants/events';
import {
  PriceSnapshot,
  PriceSnapshotDocument,
} from '../../infrastructure/schemas/price-snapshot.schema';
import {
  Stock,
  StockDocument,
} from '../../infrastructure/schemas/stock.schema';
import { CacheService } from '../../../system/application/services/cache/cache.service';
import { MarketRefreshService } from './market-refresh.service';
import { MarketSeedService } from './market-seed.service';
import Decimal from 'decimal.js';

@Injectable()
export class MarketService implements OnModuleInit {
  constructor(
    @InjectModel(Stock.name)
    private readonly stockModel: Model<StockDocument>,
    @InjectModel(PriceSnapshot.name)
    private readonly snapshotModel: Model<PriceSnapshotDocument>,
    private readonly configService: ConfigService,
    private readonly marketRefreshService: MarketRefreshService,
    private readonly marketSeedService: MarketSeedService,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.marketSeedService.seedInitialStocks();

    if (this.configService.get<boolean>('MARKET_FETCH_ON_STARTUP')) {
      await this.marketRefreshService.refreshMarket();
    }
  }

  async listQuotes() {
    return this.stockModel.find().sort({ symbol: 1 }).lean().exec();
  }

  async getQuote(symbol: string) {
    const stock = await this.stockModel
      .findOne({ symbol: symbol.toUpperCase() })
      .lean()
      .exec();

    if (!stock) {
      throw new NotFoundException('La accion solicitada no existe.');
    }

    return stock;
  }

  async getPriceHistory(symbol: string, limit = 24) {
    await this.getQuote(symbol);

    const snapshots = await this.snapshotModel
      .find({ symbol: symbol.toUpperCase() })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    return snapshots.reverse();
  }

  async getTopMovers(limit = 4) {
    return this.stockModel
      .find()
      .sort({ dayChangePercentage: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async refreshMarket() {
    return this.marketRefreshService.refreshMarket();
  }

  async listStocks(params: {
    search?: string;
    source?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, source, page = 1, limit = 50 } = params;
    const filter: Record<string, unknown> = {};

    if (source) {
      filter.source = source;
    }

    if (search) {
      const regex = { $regex: search, $options: 'i' };
      filter.$or = [{ symbol: regex }, { name: regex }];
    }

    const [data, total] = await Promise.all([
      this.stockModel
        .find(filter)
        .sort({ symbol: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.stockModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateStockPrice(symbol: string, price: number) {
    const upper = symbol.toUpperCase();
    const stock = await this.stockModel.findOne({ symbol: upper }).exec();

    if (!stock) {
      throw new NotFoundException(`Stock "${upper}" no encontrado.`);
    }

    const previousClose = stock.close;
    const dayChangePercentage = previousClose > 0
      ? new Decimal(price).minus(previousClose).dividedBy(previousClose).times(100).toDecimalPlaces(2).toNumber()
      : 0;

    stock.close = price;
    stock.previousClose = previousClose;
    stock.dayChangePercentage = dayChangePercentage;
    await stock.save();

    await this.snapshotModel.create({
      symbol: upper,
      price,
      source: 'admin',
    });

    const ttl = 86400 * 1000;
    await this.cacheService.set(`market:${upper}`, { symbol: upper, price, updatedAt: new Date().toISOString() }, ttl);
    await this.cacheService.set(`stock:${upper}:base_price`, price, ttl);
    await this.cacheService.set(`stock:${upper}:live_price`, price, ttl);

    const updated = await this.stockModel.findOne({ symbol: upper }).lean().exec();
    this.eventEmitter.emit(PRICE_UPDATE_EVENT, [updated]);

    return updated;
  }

  async createStock(dto: {
    symbol: string;
    name: string;
    currency?: string;
    close: number;
    baseVolatility?: number;
    baseDrift?: number;
  }) {
    const upper = dto.symbol.toUpperCase();

    const exists = await this.stockModel.exists({ symbol: upper }).exec();
    if (exists) {
      throw new ConflictException(`El símbolo "${upper}" ya existe.`);
    }

    const [stock] = await this.stockModel.create([
      {
        symbol: upper,
        name: dto.name,
        currency: dto.currency ?? 'CLP',
        close: dto.close,
        previousClose: dto.close,
        dayChangePercentage: 0,
        source: 'admin',
        baseVolatility: dto.baseVolatility ?? 0.015,
        baseDrift: dto.baseDrift ?? 0,
      },
    ]);

    await this.snapshotModel.create({
      symbol: upper,
      price: dto.close,
      source: 'admin',
    });

    const ttl = 86400 * 1000;
    await this.cacheService.set(`market:${upper}`, { symbol: upper, price: dto.close, updatedAt: new Date().toISOString() }, ttl);
    await this.cacheService.set(`stock:${upper}:base_price`, dto.close, ttl);
    await this.cacheService.set(`stock:${upper}:live_price`, dto.close, ttl);

    const created = await this.stockModel.findOne({ symbol: upper }).lean().exec();
    this.eventEmitter.emit(PRICE_UPDATE_EVENT, [created]);

    return created;
  }

  async deleteStock(symbol: string) {
    const upper = symbol.toUpperCase();
    const stock = await this.stockModel.findOne({ symbol: upper }).exec();

    if (!stock) {
      throw new NotFoundException(`Stock "${upper}" no encontrado.`);
    }

    if (stock.source && stock.source !== 'admin') {
      throw new ForbiddenException('No se puede eliminar un stock administrado por el proveedor.');
    }

    await this.stockModel.deleteOne({ symbol: upper }).exec();
  }
}

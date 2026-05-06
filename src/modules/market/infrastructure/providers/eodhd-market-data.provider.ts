import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { MarketQuote } from '../../domain/interfaces/market-quote.interface';
import {
  EodhdQuoteResponse,
  normalizeEodhdQuote,
} from './eodhd-quote.mapper';
import { MarketDataProvider } from './market-data-provider.interface';

@Injectable()
export class EodhdMarketDataProvider implements MarketDataProvider {
  private readonly logger = new Logger(EodhdMarketDataProvider.name);
  private readonly baseUrl: string;
  private readonly exchangeCode: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService
      .get<string>('EODHD_BASE_URL', 'https://eodhd.com/api')
      .replace(/\/+$/, '');
    this.exchangeCode = this.configService.get<string>('EODHD_EXCHANGE_CODE', 'SN');
  }

  async getQuote(symbol: string): Promise<MarketQuote> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const url = `${this.baseUrl}/real-time/${encodeURIComponent(normalizedSymbol)}`;
    const apiToken = this.configService.getOrThrow<string>('EODHD_API_KEY');
    this.logger.log(`fetching to eodhd`);
    try {
      const response = await axios.get<EodhdQuoteResponse>(url, {
        params: { api_token: apiToken, fmt: 'json' },
        timeout: 10000,
        headers: { Accept: 'application/json' },
      });

      return normalizeEodhdQuote(
        response.data,
        normalizedSymbol,
        this.exchangeCode,
      );
    } catch (error) {
      throw new Error(
        `EODHD no pudo obtener ${normalizedSymbol}: ${this.describeError(error)}`,
      );
    }
  }

  async getQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const quotes: MarketQuote[] = [];

    for (const symbol of symbols) {
      try {
        quotes.push(await this.getQuote(symbol));
      } catch (error) {
        this.logger.warn(
          `No se pudo actualizar ${symbol} desde EODHD: ${this.describeError(error)}`,
        );
      }
    }

    return quotes;
  }

  getName(): string {
    return 'EODHD';
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : 'error desconocido';
  }
}

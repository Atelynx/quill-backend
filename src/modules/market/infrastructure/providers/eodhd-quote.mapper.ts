import Decimal from 'decimal.js';
import type { RealTimeQuote } from 'eodhd';
import type { MarketQuote } from '../../domain/interfaces/market-quote.interface';
import { getCurrencyFromSymbol } from '../../../../common/utils/currency-mapper';

/**
 * Interface representing the EODHD API response.
 * We extend the official SDK's RealTimeQuote to account for optional fields
 * like 'name' which might be present in the raw JSON response but omitted
 * from the SDK's base type definitions.
 */
export interface EodhdQuoteResponse extends Partial<RealTimeQuote> {
  name?: string;
  date?: string;
}

export function normalizeEodhdQuote(
  response: EodhdQuoteResponse,
  requestedSymbol: string,
  exchangeCode: string,
): MarketQuote {
  const price = toRequiredNumber(response.close, requestedSymbol);
  const previousClose = toOptionalNumber(response.previousClose);
  const change = resolveChange(response.change, price, previousClose);
  const changePercent = resolveChangePercent(
    response.change_p,
    change,
    previousClose,
  );
  const symbol = (response.code ?? requestedSymbol).toUpperCase();

  return {
    symbol,
    name: response.name ?? symbol,
    price,
    close: price,
    currency: getCurrencyFromSymbol(requestedSymbol),
    timestamp: resolveTimestamp(response),
    exchange: exchangeCode,
    source: 'eodhd',
    open: toOptionalNumber(response.open),
    high: toOptionalNumber(response.high),
    low: toOptionalNumber(response.low),
    previousClose,
    change,
    changePercent,
    dayChangePercentage: changePercent,
    volume: toOptionalNumber(response.volume),
  };
}

function toRequiredNumber(value: unknown, symbol: string): number {
  const parsed = toOptionalNumber(value);

  if (parsed === undefined) {
    throw new Error(`EODHD no retorno precio valido para ${symbol}`);
  }

  return parsed;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = new Decimal(value as number | string);
  return parsed.isFinite() ? parsed.toDecimalPlaces(4).toNumber() : undefined;
}

function resolveChange(
  rawChange: unknown,
  price: number,
  previousClose?: number,
): number | undefined {
  const parsed = toOptionalNumber(rawChange);

  if (parsed !== undefined || previousClose === undefined) {
    return parsed;
  }

  return new Decimal(price).minus(previousClose).toDecimalPlaces(4).toNumber();
}

function resolveChangePercent(
  rawPercent: unknown,
  change?: number,
  previousClose?: number,
): number | undefined {
  const parsed = toOptionalNumber(rawPercent);

  if (parsed !== undefined || change === undefined || !previousClose) {
    return parsed;
  }

  return new Decimal(change)
    .dividedBy(previousClose)
    .times(100)
    .toDecimalPlaces(4)
    .toNumber();
}

function resolveTimestamp(response: EodhdQuoteResponse): Date {
  if (response.timestamp) {
    return new Date(response.timestamp * 1000);
  }

  return response.date ? new Date(response.date) : new Date();
}

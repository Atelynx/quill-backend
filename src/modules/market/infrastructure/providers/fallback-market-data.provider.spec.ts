import { FallbackMarketDataProvider } from './fallback-market-data.provider';
import type { MarketDataProvider } from './market-data-provider.interface';
import type { MarketQuote } from '../../domain/interfaces/market-quote.interface';

type MockedMarketDataProvider = Omit<
  jest.Mocked<MarketDataProvider>,
  'getSeedData' | 'getRefreshSchedule'
> & {
  getSeedData: jest.MockedFunction<
    NonNullable<MarketDataProvider['getSeedData']>
  >;
  getRefreshSchedule: jest.MockedFunction<
    NonNullable<MarketDataProvider['getRefreshSchedule']>
  >;
};

describe('FallbackMarketDataProvider', () => {
  let primary: MockedMarketDataProvider;
  let fallback: jest.Mocked<MarketDataProvider>;
  let provider: FallbackMarketDataProvider;
  let primaryGetQuote: jest.MockedFunction<MarketDataProvider['getQuote']>;
  let fallbackGetQuote: jest.MockedFunction<MarketDataProvider['getQuote']>;

  beforeEach(() => {
    primaryGetQuote = jest.fn();
    fallbackGetQuote = jest.fn();
    primary = {
      getQuote: primaryGetQuote,
      getQuotes: jest.fn(),
      getName: jest.fn().mockReturnValue('EODHD'),
      getSeedData: jest.fn(),
      getRefreshSchedule: jest.fn(),
    } as MockedMarketDataProvider;

    fallback = {
      getQuote: fallbackGetQuote,
      getName: jest.fn().mockReturnValue('Mock'),
    } as unknown as jest.Mocked<MarketDataProvider>;

    provider = new FallbackMarketDataProvider(primary, fallback);
  });

  describe('getQuote', () => {
    it('returns primary result when primary succeeds', async () => {
      const expected = {
        symbol: 'AAPL',
        price: 150,
        currency: 'USD',
        timestamp: new Date(),
        exchange: 'EODHD',
      };
      primary.getQuote.mockResolvedValue(expected);

      const result = await provider.getQuote('AAPL');

      expect(result).toBe(expected);
      expect(primaryGetQuote).toHaveBeenCalledWith('AAPL');
      expect(fallbackGetQuote).not.toHaveBeenCalled();
    });

    it('falls back to mock when primary fails', async () => {
      primary.getQuote.mockRejectedValue(new Error('API error'));
      const expected = {
        symbol: 'AAPL',
        price: 145,
        currency: 'USD',
        timestamp: new Date(),
        exchange: 'MOCK',
      };
      fallback.getQuote.mockResolvedValue(expected);

      const result = await provider.getQuote('AAPL');

      expect(result).toBe(expected);
      expect(primaryGetQuote).toHaveBeenCalledWith('AAPL');
      expect(fallbackGetQuote).toHaveBeenCalledWith('AAPL');
    });

    it('rethrows when both primary and fallback fail', async () => {
      primary.getQuote.mockRejectedValue(new Error('Primary down'));
      fallback.getQuote.mockRejectedValue(new Error('Fallback down too'));

      await expect(provider.getQuote('AAPL')).rejects.toThrow(
        'Fallback down too',
      );
    });
  });

  describe('getQuotes', () => {
    it('returns all quotes from primary when all succeed', async () => {
      const quoteA = {
        symbol: 'AAPL',
        price: 150,
        currency: 'USD',
        timestamp: new Date(),
        exchange: 'EODHD',
      } satisfies MarketQuote;
      const quoteB = {
        symbol: 'MSFT',
        price: 300,
        currency: 'USD',
        timestamp: new Date(),
        exchange: 'EODHD',
      } satisfies MarketQuote;
      primary.getQuote
        .mockResolvedValueOnce(quoteA)
        .mockResolvedValueOnce(quoteB);

      const results = await provider.getQuotes(['AAPL', 'MSFT']);

      expect(results).toEqual([quoteA, quoteB]);
      expect(fallbackGetQuote).not.toHaveBeenCalled();
    });

    it('falls back per-symbol when primary fails for some symbols', async () => {
      const quoteA = {
        symbol: 'AAPL',
        price: 150,
        currency: 'USD',
        timestamp: new Date(),
        exchange: 'EODHD',
      } satisfies MarketQuote;
      const quoteB = {
        symbol: 'MSFT',
        price: 290,
        currency: 'USD',
        timestamp: new Date(),
        exchange: 'MOCK',
      } satisfies MarketQuote;
      primary.getQuote
        .mockResolvedValueOnce(quoteA)
        .mockRejectedValueOnce(new Error('Not found'));
      fallback.getQuote.mockResolvedValueOnce(quoteB);

      const results = await provider.getQuotes(['AAPL', 'MSFT']);

      expect(results).toHaveLength(2);
      expect(results[0]).toBe(quoteA);
      expect(results[1]).toBe(quoteB);
    });

    it('skips symbol when both providers fail', async () => {
      primary.getQuote.mockRejectedValue(new Error('Primary error'));
      fallback.getQuote.mockRejectedValue(new Error('Fallback error'));

      const results = await provider.getQuotes(['AAPL']);

      expect(results).toHaveLength(0);
    });
  });

  describe('getName', () => {
    it('combines primary and fallback names', () => {
      expect(provider.getName()).toBe('EODHD_with_fallback_to_Mock');
    });
  });

  describe('getSeedData', () => {
    it('delegates to primary', () => {
      const seedData = [
        {
          symbol: 'AAPL',
          name: 'Apple',
          currency: 'USD',
          close: 150,
        },
      ];
      primary.getSeedData.mockReturnValue(seedData);

      expect(provider.getSeedData()).toBe(seedData);
    });

    it('returns empty array when primary has no getSeedData', () => {
      const optionalPrimary = primary as unknown as {
        getSeedData?: MarketDataProvider['getSeedData'];
      };
      delete optionalPrimary.getSeedData;

      expect(provider.getSeedData()).toEqual([]);
    });
  });

  describe('getRefreshSchedule', () => {
    it('delegates to primary', () => {
      const schedule = { cronExpression: '0 0 * * *' };
      primary.getRefreshSchedule.mockReturnValue(schedule);

      expect(provider.getRefreshSchedule()).toBe(schedule);
    });

    it('returns undefined when primary has no schedule', () => {
      const optionalPrimary = primary as unknown as {
        getRefreshSchedule?: MarketDataProvider['getRefreshSchedule'];
      };
      delete optionalPrimary.getRefreshSchedule;

      expect(provider.getRefreshSchedule()).toBeUndefined();
    });
  });
});

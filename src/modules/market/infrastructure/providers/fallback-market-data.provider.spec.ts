import { FallbackMarketDataProvider } from './fallback-market-data.provider';
import type { MarketDataProvider } from './market-data-provider.interface';

type MockedMarketDataProvider = Omit<
  jest.Mocked<MarketDataProvider>,
  'getSeedData' | 'getRefreshSchedule'
> & {
  getSeedData: jest.MockedFunction<NonNullable<MarketDataProvider['getSeedData']>>;
  getRefreshSchedule: jest.MockedFunction<
    NonNullable<MarketDataProvider['getRefreshSchedule']>
  >;
};

describe('FallbackMarketDataProvider', () => {
  let primary: MockedMarketDataProvider;
  let fallback: jest.Mocked<MarketDataProvider>;
  let provider: FallbackMarketDataProvider;

  beforeEach(() => {
    primary = {
      getQuote: jest.fn(),
      getQuotes: jest.fn(),
      getName: jest.fn().mockReturnValue('EODHD'),
      getSeedData: jest.fn(),
      getRefreshSchedule: jest.fn(),
    } as MockedMarketDataProvider;

    fallback = {
      getQuote: jest.fn(),
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
      expect(primary.getQuote).toHaveBeenCalledWith('AAPL');
      expect(fallback.getQuote).not.toHaveBeenCalled();
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
      expect(primary.getQuote).toHaveBeenCalledWith('AAPL');
      expect(fallback.getQuote).toHaveBeenCalledWith('AAPL');
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
      } as any;
      const quoteB = {
        symbol: 'MSFT',
        price: 300,
      } as any;
      primary.getQuote
        .mockResolvedValueOnce(quoteA)
        .mockResolvedValueOnce(quoteB);

      const results = await provider.getQuotes(['AAPL', 'MSFT']);

      expect(results).toEqual([quoteA, quoteB]);
      expect(fallback.getQuote).not.toHaveBeenCalled();
    });

    it('falls back per-symbol when primary fails for some symbols', async () => {
      const quoteA = { symbol: 'AAPL', price: 150 } as any;
      const quoteB = { symbol: 'MSFT', price: 290 } as any;
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
      const seedData = [{ symbol: 'AAPL', name: 'Apple' }] as any;
      primary.getSeedData.mockReturnValue(seedData);

      expect(provider.getSeedData()).toBe(seedData);
    });

    it('returns empty array when primary has no getSeedData', () => {
      delete (primary as any).getSeedData;

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
      delete (primary as any).getRefreshSchedule;

      expect(provider.getRefreshSchedule()).toBeUndefined();
    });
  });
});

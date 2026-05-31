import { ConfigService } from '@nestjs/config';
import { MockMarketDataProvider } from './mock-market-data.provider';

describe('MockMarketDataProvider', () => {
  let provider: MockMarketDataProvider;
  let configService: ConfigService;

  beforeEach(() => {
    configService = ({
      get: jest.fn((_key: string, fallback?: unknown) => fallback),
    } as unknown) as ConfigService;
  });

  beforeEach(() => {
    provider = new MockMarketDataProvider(configService);
  });

  describe('getQuote()', () => {
    it('should return MarketQuote with all required fields', async () => {
      const quote = await provider.getQuote('AAPL');

      expect(quote).toBeDefined();
      expect(quote.symbol).toBe('AAPL');
      expect(typeof quote.price).toBe('number');
      expect(quote.currency).toBe('USD');
      expect(quote.timestamp).toBeInstanceOf(Date);
      expect(quote.exchange).toBe('MOCK');
    });

    it('should generate different prices for same symbol (momentum)', async () => {
      const quote1 = await provider.getQuote('COPEC');
      const quote2 = await provider.getQuote('COPEC');

      expect(quote1.price).not.toBe(quote2.price);
      expect(typeof quote1.price).toBe('number');
      expect(typeof quote2.price).toBe('number');
    });

    it('should handle uppercase and lowercase symbols', async () => {
      const quote1 = await provider.getQuote('aapl');
      const quote2 = await provider.getQuote('AAPL');

      expect(quote1.symbol).toBe('AAPL');
      expect(quote2.symbol).toBe('AAPL');
    });
  });

  describe('getName()', () => {
    it('should return "Mock"', () => {
      expect(provider.getName()).toBe('Mock');
    });
  });

  describe('getSeedData()', () => {
    it('returns seed stocks with correct shape', () => {
      const seeds = provider.getSeedData();

      expect(Array.isArray(seeds)).toBe(true);
      expect(seeds.length).toBeGreaterThan(0);
      expect(seeds[0]).toMatchObject({
        symbol: expect.any(String),
        name: expect.any(String),
        currency: expect.any(String),
        close: expect.any(Number),
        previousClose: expect.any(Number),
        dayChangePercentage: 1.5,
        source: 'mock',
      });
    });
  });

  describe('getRefreshSchedule()', () => {
    it('returns cron from config with default fallback', () => {
      const schedule = provider.getRefreshSchedule();

      expect(schedule).toBeDefined();
      expect(schedule!.cronExpression).toBe('0 30 18 * * 1-5');
    });

    it('uses config value when provided', () => {
      configService = ({
        get: jest.fn((key: string) => {
          if (key === 'MOCK_DAILY_REFRESH_CRON') return '0 0 * * *';
          return undefined;
        }),
      } as unknown) as ConfigService;
      provider = new MockMarketDataProvider(configService);

      const schedule = provider.getRefreshSchedule();

      expect(schedule!.cronExpression).toBe('0 0 * * *');
    });
  });
});

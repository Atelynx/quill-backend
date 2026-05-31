import { ConfigService } from '@nestjs/config';
import { MockCurrencyDataProvider } from './mock-currency-data.provider';

describe('MockCurrencyDataProvider', () => {
  let provider: MockCurrencyDataProvider;
  let configService: Partial<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'MOCK_CURRENCY_SYMBOLS') return 'USDCLP,EURUSD';
        return fallback;
      }),
    };
    provider = new MockCurrencyDataProvider(configService as ConfigService);
  });

  describe('getName', () => {
    it('returns mock', () => {
      expect(provider.getName()).toBe('mock');
    });
  });

  describe('getSymbols', () => {
    it('returns configured symbols', () => {
      expect(provider.getSymbols()).toEqual(['USDCLP', 'EURUSD']);
    });
  });

  describe('getRefreshSchedule', () => {
    it('returns undefined', () => {
      expect(provider.getRefreshSchedule()).toBeUndefined();
    });
  });

  describe('getQuote', () => {
    it('returns a MarketQuote with all required fields', async () => {
      const quote = await provider.getQuote('USDCLP');

      expect(quote).toBeDefined();
      expect(quote.symbol).toBe('USDCLP');
      expect(typeof quote.price).toBe('number');
      expect(quote.currency).toBe('USD');
      expect(quote.timestamp).toBeInstanceOf(Date);
      expect(quote.exchange).toBe('FOREX');
    });

    it('generates different prices on successive calls', async () => {
      const quote1 = await provider.getQuote('USDCLP');
      const quote2 = await provider.getQuote('USDCLP');

      expect(quote1.price).not.toBe(quote2.price);
    });

    it('handles uppercase and lowercase symbols', async () => {
      const quote1 = await provider.getQuote('usdclp');
      const quote2 = await provider.getQuote('USDCLP');

      expect(quote1.symbol).toBe('USDCLP');
      expect(quote2.symbol).toBe('USDCLP');
    });

    it('creates new entry for unknown symbol', async () => {
      const quote = await provider.getQuote('GBPJPY');

      expect(quote.symbol).toBe('GBPJPY');
      expect(typeof quote.price).toBe('number');
      expect(quote.currency).toBe('JPY');
    });

    it('detects USD in symbol for currency field', async () => {
      const quote = await provider.getQuote('USDJPY');
      expect(quote.currency).toBe('USD');
    });
  });
});

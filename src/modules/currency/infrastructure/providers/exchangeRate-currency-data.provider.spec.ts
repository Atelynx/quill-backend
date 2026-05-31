import { ConfigService } from '@nestjs/config';
import { ExchangeRateCurrencyDataProvider } from './exchangeRate-currency-data.provider';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ExchangeRateCurrencyDataProvider', () => {
  let provider: ExchangeRateCurrencyDataProvider;
  let configService: Partial<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          EXCHANGERATE_API_KEY: 'test-api-key',
          EXCHANGERATE_SYMBOLS: 'USDCLP,EURUSD',
          EXCHANGERATE_BASE_URL: 'https://v6.exchangerate-api.com/v6',
          EXCHANGERATE_REFRESH_CRON: '0 0 * * * *',
        };
        return values[key] ?? fallback;
      }),
    };
  });

  describe('getName', () => {
    it('returns exchangeRate', () => {
      provider = new ExchangeRateCurrencyDataProvider(configService as ConfigService);
      expect(provider.getName()).toBe('exchangeRate');
    });
  });

  describe('getSymbols', () => {
    it('parses symbols from config', () => {
      provider = new ExchangeRateCurrencyDataProvider(configService as ConfigService);
      expect(provider.getSymbols()).toEqual(['USDCLP', 'EURUSD']);
    });
  });

  describe('getRefreshSchedule', () => {
    it('returns cron expression from config', () => {
      provider = new ExchangeRateCurrencyDataProvider(configService as ConfigService);
      expect(provider.getRefreshSchedule()).toEqual({ cronExpression: '0 0 * * * *' });
    });
  });

  describe('getQuote', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: 'success',
          conversion_rates: { CLP: 950.5, USD: 1.12 },
          time_last_update_unix: 1700000000,
        }),
      });
    });

    it('returns a MarketQuote for a valid symbol', async () => {
      provider = new ExchangeRateCurrencyDataProvider(configService as ConfigService);

      const quote = await provider.getQuote('USDCLP');

      expect(quote).toMatchObject({
        symbol: 'USDCLP',
        price: 950.5,
        close: 950.5,
        currency: 'CLP',
        exchange: 'exchangeRate',
      });
      expect(quote.timestamp).toBeInstanceOf(Date);
    });

    it('normalizes symbol to uppercase', async () => {
      provider = new ExchangeRateCurrencyDataProvider(configService as ConfigService);

      const quote = await provider.getQuote('usdclp');

      expect(quote.symbol).toBe('USDCLP');
    });

    it('trims symbol whitespace', async () => {
      provider = new ExchangeRateCurrencyDataProvider(configService as ConfigService);

      const quote = await provider.getQuote('  usdclp  ');

      expect(quote.symbol).toBe('USDCLP');
    });

    it('throws when API key is missing', async () => {
      configService.get = jest.fn((key: string, fallback?: unknown) => {
        if (key === 'EXCHANGERATE_API_KEY') return undefined;
        if (key === 'EXCHANGERATE_SYMBOLS') return 'USDCLP';
        return fallback;
      });
      provider = new ExchangeRateCurrencyDataProvider(configService as ConfigService);

      await expect(provider.getQuote('USDCLP')).rejects.toThrow(
        'EXCHANGERATE_API_KEY is not configured',
      );
    });

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });
      provider = new ExchangeRateCurrencyDataProvider(configService as ConfigService);

      await expect(provider.getQuote('USDCLP')).rejects.toThrow(
        /External provider.*failed for USDCLP/,
      );
    });

    it('throws when API returns non-success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ result: 'error' }),
      });
      provider = new ExchangeRateCurrencyDataProvider(configService as ConfigService);

      await expect(provider.getQuote('USDCLP')).rejects.toThrow(
        /External provider.*failed for USDCLP/,
      );
    });

    it('throws when quote currency rate is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          result: 'success',
          conversion_rates: { USD: 1 },
          time_last_update_unix: 1700000000,
        }),
      });
      provider = new ExchangeRateCurrencyDataProvider(configService as ConfigService);

      await expect(provider.getQuote('USDXYZ')).rejects.toThrow(
        /External provider.*failed for USDXYZ/,
      );
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
      provider = new ExchangeRateCurrencyDataProvider(configService as ConfigService);

      await expect(provider.getQuote('USDCLP')).rejects.toThrow(
        /External provider.*failed for USDCLP/,
      );
    });
  });
});

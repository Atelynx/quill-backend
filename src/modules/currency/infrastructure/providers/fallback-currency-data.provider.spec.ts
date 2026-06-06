import { FallbackCurrencyDataProvider } from './fallback-currency-data.provider';
import type { CurrencyDataProvider } from '../../domain/interfaces/currency-data-provider.interface';

describe('FallbackCurrencyDataProvider', () => {
  let primary: jest.Mocked<CurrencyDataProvider>;
  let fallback: jest.Mocked<CurrencyDataProvider>;
  let provider: FallbackCurrencyDataProvider;

  beforeEach(() => {
    primary = {
      getQuote: jest.fn(),
      getName: jest.fn().mockReturnValue('exchangeRate'),
      getSymbols: jest.fn().mockReturnValue(['USDCLP', 'EURUSD']),
      getRefreshSchedule: jest.fn(),
    } as unknown as jest.Mocked<CurrencyDataProvider>;

    fallback = {
      getQuote: jest.fn(),
      getName: jest.fn().mockReturnValue('mock'),
    } as unknown as jest.Mocked<CurrencyDataProvider>;

    provider = new FallbackCurrencyDataProvider(primary, fallback);
  });

  describe('getQuote', () => {
    it('returns primary result when primary succeeds', async () => {
      const expected = {
        symbol: 'USDCLP',
        price: 950,
        currency: 'CLP',
        timestamp: new Date(),
        exchange: 'FOREX',
      };
      primary.getQuote.mockResolvedValue(expected);

      const result = await provider.getQuote('USDCLP');

      expect(result).toBe(expected);
      expect(primary.getQuote).toHaveBeenCalledWith('USDCLP');
      expect(fallback.getQuote).not.toHaveBeenCalled();
    });

    it('falls back to mock when primary fails', async () => {
      primary.getQuote.mockRejectedValue(new Error('API error'));
      const expected = {
        symbol: 'USDCLP',
        price: 900,
        currency: 'CLP',
        timestamp: new Date(),
        exchange: 'FOREX',
      };
      fallback.getQuote.mockResolvedValue(expected);

      const result = await provider.getQuote('USDCLP');

      expect(result).toBe(expected);
      expect(primary.getQuote).toHaveBeenCalledWith('USDCLP');
      expect(fallback.getQuote).toHaveBeenCalledWith('USDCLP');
    });

    it('rethrows when both primary and fallback fail', async () => {
      primary.getQuote.mockRejectedValue(new Error('Primary down'));
      fallback.getQuote.mockRejectedValue(new Error('Fallback down'));

      await expect(provider.getQuote('USDCLP')).rejects.toThrow(
        'Fallback down',
      );
    });
  });

  describe('getName', () => {
    it('combines primary and fallback names', () => {
      expect(provider.getName()).toBe(
        'exchangeRate_with_fallback_to_mock',
      );
    });
  });

  describe('getSymbols', () => {
    it('delegates to primary', () => {
      expect(provider.getSymbols()).toEqual(['USDCLP', 'EURUSD']);
    });
  });

  describe('getRefreshSchedule', () => {
    it('delegates to primary', () => {
      const schedule = { cronExpression: '0 0 * * * *' };
      primary.getRefreshSchedule.mockReturnValue(schedule);

      expect(provider.getRefreshSchedule()).toBe(schedule);
    });

    it('returns undefined when primary has no schedule', () => {
      delete (primary as any).getRefreshSchedule;

      expect(provider.getRefreshSchedule()).toBeUndefined();
    });
  });
});

import { ConfigService } from '@nestjs/config';
import { MockMarketDataProvider } from './mock-market-data.provider';
import { config } from 'process';

describe('MockMarketDataProvider', () => {
  let provider: MockMarketDataProvider;
    let configService: ConfigService;

  beforeEach(() => {

    configService = ({
      get: jest.fn(),
    } as unknown) as ConfigService;
  })

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

    it('should generate consistent prices for same symbol (momentum)', async () => {
      const quote1 = await provider.getQuote('COPEC');
      const quote2 = await provider.getQuote('COPEC');

      // Prices should be different (due to momentum)
      expect(quote1.price).not.toBe(quote2.price);
      // But both should be valid numbers
      expect(typeof quote1.price).toBe('number');
      expect(typeof quote2.price).toBe('number');
    });

    it('should handle uppercase and lowercase symbols', async () => {
      const quote1 = await provider.getQuote('aapl');
      const quote2 = await provider.getQuote('AAPL');

      // Should normalize to uppercase
      expect(quote1.symbol).toBe('AAPL');
      expect(quote2.symbol).toBe('AAPL');
    });
  });

  describe('getName()', () => {
    it('should return "Mock"', () => {
      expect(provider.getName()).toBe('Mock');
    });
  });
});

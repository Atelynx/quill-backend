import { CurrencyRateService } from './currency-rate.service';

describe('CurrencyRateService', () => {
  let service: CurrencyRateService;
  let provider: { getSymbols: jest.Mock; getName: jest.Mock };
  let cacheService: { get: jest.Mock; set: jest.Mock };

  beforeEach(() => {
    provider = {
      getSymbols: jest.fn(),
      getName: jest.fn(),
    };
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };
    service = new CurrencyRateService(provider as never, cacheService as never);
  });

  describe('getRates', () => {
    it('returns rates for all symbols', async () => {
      provider.getSymbols.mockReturnValue(['EURUSD', 'GBPUSD']);
      cacheService.get
        .mockResolvedValueOnce(1.1)
        .mockResolvedValueOnce(1.12)
        .mockResolvedValueOnce(1.3)
        .mockResolvedValueOnce(1.28);

      const rates = await service.getRates();

      expect(rates).toHaveLength(2);
      expect(rates[0]).toMatchObject({ symbol: 'EURUSD', rate: 1.12, basePrice: 1.1 });
      expect(rates[1]).toMatchObject({ symbol: 'GBPUSD', rate: 1.28, basePrice: 1.3 });
    });

    it('skips symbols with missing cache data', async () => {
      provider.getSymbols.mockReturnValue(['EURUSD', 'GBPUSD']);
      cacheService.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(1.12)
        .mockResolvedValueOnce(1.3)
        .mockResolvedValueOnce(1.28);

      const rates = await service.getRates();

      expect(rates).toHaveLength(1);
      expect(rates[0].symbol).toBe('GBPUSD');
    });

    it('returns empty array when no symbols configured', async () => {
      provider.getSymbols.mockReturnValue([]);
      const rates = await service.getRates();
      expect(rates).toEqual([]);
    });

    it('computes dayChangePercentage correctly', async () => {
      provider.getSymbols.mockReturnValue(['EURUSD']);
      cacheService.get
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(105);

      const rates = await service.getRates();

      expect(rates[0].dayChangePercentage).toBe(5);
    });

    it('computes negative dayChangePercentage', async () => {
      provider.getSymbols.mockReturnValue(['EURUSD']);
      cacheService.get
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(95);

      const rates = await service.getRates();

      expect(rates[0].dayChangePercentage).toBe(-5);
    });
  });

  describe('getRate', () => {
    it('returns rate for a specific symbol with uppercase normalization', async () => {
      cacheService.get
        .mockResolvedValueOnce(1.1)
        .mockResolvedValueOnce(1.12);

      const rate = await service.getRate('eurusd');

      expect(rate).toMatchObject({ symbol: 'EURUSD', rate: 1.12, basePrice: 1.1 });
    });

    it('returns null when base price is missing', async () => {
      cacheService.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(1.12);

      const rate = await service.getRate('EURUSD');
      expect(rate).toBeNull();
    });

    it('returns null when live price is missing', async () => {
      cacheService.get
        .mockResolvedValueOnce(1.1)
        .mockResolvedValueOnce(null);

      const rate = await service.getRate('EURUSD');
      expect(rate).toBeNull();
    });

    it('computes dayChangePercentage for single rate', async () => {
      cacheService.get
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(210);

      const rate = await service.getRate('USDCLP');
      expect(rate!.dayChangePercentage).toBe(5);
    });
  });
});

import { ConfigService } from '@nestjs/config';
import { EODHDClient } from 'eodhd';
import { EodhdMarketDataProvider } from './eodhd-market-data.provider';
import { Logger } from '@nestjs/common';

jest.mock('eodhd');

describe('EodhdMarketDataProvider', () => {
  const mockRealTime = jest.fn();
  let provider: EodhdMarketDataProvider;
  let configMock: Partial<ConfigService>;
  let stockModelMock: { findOne: jest.Mock };
  let snapshotModelMock: { findOne: jest.Mock; create: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    (EODHDClient as jest.Mock).mockImplementation(() => ({
      realTime: mockRealTime,
    }));

    configMock = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          EODHD_BASE_URL: 'https://eodhd.com/api',
          EODHD_EXCHANGE_CODE: 'SN',
        };
        return values[key] ?? fallback;
      }),
      getOrThrow: jest.fn(() => 'test-token'),
    };

    stockModelMock = {
      findOne: jest.fn(() => ({
        lean: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue({
            symbol: 'SQM-B.SN',
            name: 'SQM-B',
            previousClose: 100,
            currency: 'CLP',
          }),
        })),
      })),
    };

    snapshotModelMock = {
      findOne: jest.fn(() => ({
        sort: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue(null),
          })),
        })),
      })),
      create: jest.fn().mockResolvedValue(undefined),
    };

    provider = new EodhdMarketDataProvider(
      configMock as ConfigService,
      stockModelMock as never,
      snapshotModelMock as never,
    );
  });
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  it('inicializa el cliente SDK correctamente', async () => {
    mockRealTime.mockResolvedValue({
      code: 'SQM-B.SN',
      close: 100,
      timestamp: 1710000000,
    });

    await provider.getQuote('SQM-B.SN');

    expect(EODHDClient).toHaveBeenCalledWith(
      expect.objectContaining({
        apiToken: 'test-token',
        baseUrl: 'https://eodhd.com/api',
      }),
    );
    expect(mockRealTime).toHaveBeenCalledWith('SQM-B.SN');
  });

  it('normaliza una respuesta EODHD correctamente', async () => {
    mockRealTime.mockResolvedValue({
      code: 'COPEC.SN',
      timestamp: 1710000000,
      close: 7200,
      previousClose: 7000,
      change: 200,
      change_p: 2.8571,
      volume: 12345,
    });

    const quote = await provider.getQuote('COPEC.SN');

    expect(quote).toMatchObject({
      symbol: 'COPEC.SN',
      name: 'COPEC.SN',
      price: 7200,
      previousClose: 7000,
      change: 200,
      changePercent: 2.8571,
      volume: 12345,
      source: 'eodhd',
      exchange: 'SN',
      currency: 'CLP',
    });
  });

  it('calcula variacion si EODHD no la envia', async () => {
    mockRealTime.mockResolvedValue({
      code: 'CHILE.SN',
      close: 105,
      previousClose: 100,
    });

    const quote = await provider.getQuote('CHILE.SN');

    expect(quote.change).toBe(5);
    expect(quote.changePercent).toBe(5);
  });

  it('maneja errores de API sin revelar secretos', async () => {
    mockRealTime.mockRejectedValue(
      new Error('Request failed with status code 401'),
    );

    await expect(provider.getQuote('CMPC.SN')).rejects.toThrow(
      'EODHD no pudo obtener CMPC.SN',
    );
  });

  it('ignora un ticker fallido y continua con los demas', async () => {
    mockRealTime
      .mockResolvedValueOnce({ code: 'COPEC.SN', close: 7200 })
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ code: 'CHILE.SN', close: 105 });

    const quotes = await provider.getQuotes([
      'COPEC.SN',
      'FALLA.SN',
      'CHILE.SN',
    ]);

    expect(quotes.map((quote) => quote.symbol)).toEqual([
      'COPEC.SN',
      'CHILE.SN',
    ]);
    expect(mockRealTime).toHaveBeenCalledTimes(3);
  });

  it('declares a daily refresh schedule', () => {
    const schedule = provider.getRefreshSchedule();
    expect(schedule).toBeDefined();
    expect(schedule.cronExpression).toBe('0 30 18 * * 1-5');
  });

  it('uses config-based cron for refresh schedule', () => {
    configMock.get = jest.fn((key: string, fallback?: unknown) => {
      if (key === 'EODHD_DAILY_REFRESH_CRON') return '0 0 * * *';
      if (key === 'EODHD_EXCHANGE_CODE') return 'SN';
      if (key === 'EODHD_SYMBOLS') return 'AAPL,MSFT';
      return fallback;
    });
    provider = new EodhdMarketDataProvider(
      configMock as ConfigService,
      stockModelMock as never,
      snapshotModelMock as never,
    );

    const schedule = provider.getRefreshSchedule();

    expect(schedule.cronExpression).toBe('0 0 * * *');
  });

  it('getName returns EODHD', () => {
    expect(provider.getName()).toBe('EODHD');
  });

  describe('getSeedData', () => {
    it('returns seed data from EODHD_SYMBOLS', () => {
      configMock.get = jest.fn((key: string, fallback?: unknown) => {
        if (key === 'EODHD_SYMBOLS') return 'AAPL,MSFT';
        if (key === 'EODHD_EXCHANGE_CODE') return 'US';
        return fallback;
      });
      configMock.getOrThrow = jest.fn(() => 'test-token');
      provider = new EodhdMarketDataProvider(
        configMock as ConfigService,
        stockModelMock as never,
        snapshotModelMock as never,
      );

      const seeds = provider.getSeedData();

      expect(seeds).toHaveLength(2);
      expect(seeds[0]).toMatchObject({
        symbol: 'AAPL',
        close: 0,
        source: 'eodhd',
      });
      expect(seeds[1]).toMatchObject({
        symbol: 'MSFT',
        close: 0,
        source: 'eodhd',
      });
    });

    it('returns empty array when no symbols configured', () => {
      configMock.get = jest.fn((key: string, fallback?: unknown) => {
        if (key === 'EODHD_SYMBOLS') return '';
        if (key === 'EODHD_EXCHANGE_CODE') return 'US';
        return fallback;
      });
      configMock.getOrThrow = jest.fn(() => 'test-token');
      provider = new EodhdMarketDataProvider(
        configMock as ConfigService,
        stockModelMock as never,
        snapshotModelMock as never,
      );

      expect(provider.getSeedData()).toEqual([]);
    });
  });

  describe('cache-hit path', () => {
    it('consulta el día actual usando America/Santiago', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-06-16T02:30:00.000Z'));
      mockRealTime.mockResolvedValue({
        code: 'SQM-B.SN',
        close: 100,
        timestamp: 1710000000,
      });

      try {
        await provider.getQuote('SQM-B.SN');

        expect(snapshotModelMock.findOne).toHaveBeenCalledWith({
          symbol: 'SQM-B.SN',
          createdAt: {
            $gte: new Date('2026-06-15T04:00:00.000Z'),
            $lt: new Date('2026-06-16T04:00:00.000Z'),
          },
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns cached snapshot when today snapshot exists', async () => {
      snapshotModelMock.findOne = jest.fn(() => ({
        sort: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue({
              symbol: 'SQM-B.SN',
              price: 105,
              source: 'eodhd',
              createdAt: new Date(),
            }),
          })),
        })),
      }));

      const quote = await provider.getQuote('SQM-B.SN');

      expect(quote.price).toBe(105);
      expect(mockRealTime).not.toHaveBeenCalled();
    });

    it('returns null from getTodaySnapshot when no stock found', async () => {
      snapshotModelMock.findOne = jest.fn(() => ({
        sort: jest.fn(() => ({
          lean: jest.fn(() => ({
            exec: jest.fn().mockResolvedValue({
              symbol: 'MISSING.SN',
              price: 100,
              source: 'eodhd',
              createdAt: new Date(),
            }),
          })),
        })),
      }));
      stockModelMock.findOne = jest.fn(() => ({
        lean: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue(null),
        })),
      }));

      mockRealTime.mockResolvedValue({
        code: 'MISSING.SN',
        close: 110,
        timestamp: 1710000000,
      });

      const quote = await provider.getQuote('MISSING.SN');

      expect(quote.price).toBe(110);
      expect(mockRealTime).toHaveBeenCalled();
    });
  });

  it('propaga error cuando EODHD no retorna precio', async () => {
    mockRealTime.mockResolvedValue({
      code: 'NOPRICE.SN',
      timestamp: 1710000000,
    });

    await expect(provider.getQuote('NOPRICE.SN')).rejects.toThrow(
      'EODHD no pudo obtener NOPRICE.SN',
    );
  });

  it('persists snapshot after successful API fetch', async () => {
    mockRealTime.mockResolvedValue({
      code: 'COPEC.SN',
      close: 7200,
      timestamp: 1710000000,
    });

    await provider.getQuote('COPEC.SN');

    expect(snapshotModelMock.create).toHaveBeenCalledWith({
      symbol: 'COPEC.SN',
      price: 7200,
      source: 'eodhd',
    });
  });
});

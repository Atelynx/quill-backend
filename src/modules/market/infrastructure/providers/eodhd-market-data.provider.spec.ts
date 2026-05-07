import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EodhdMarketDataProvider } from './eodhd-market-data.provider';

jest.mock('axios');

describe('EodhdMarketDataProvider', () => {
  const axiosGet = axios.get as jest.Mock;
  let provider: EodhdMarketDataProvider;
  let configMock: Partial<ConfigService>;
  let stockModelMock: any;
  let snapshotModelMock: any;

  beforeEach(() => {
    jest.clearAllMocks();

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
      stockModelMock,
      snapshotModelMock,
    );
  });

  it('construye la URL sin exponer la API key', async () => {
    axiosGet.mockResolvedValue({
      data: { code: 'SQM-B.SN', close: 100, timestamp: 1710000000 },
    });

    await provider.getQuote('SQM-B.SN');

    expect(axiosGet).toHaveBeenCalledWith(
      'https://eodhd.com/api/real-time/SQM-B.SN',
      expect.objectContaining({
        params: { api_token: 'test-token', fmt: 'json' },
      }),
    );
    expect(axiosGet.mock.calls[0][0]).not.toContain('test-token');
  });

  it('normaliza una respuesta EODHD correctamente', async () => {
    axiosGet.mockResolvedValue({
      data: {
        code: 'COPEC.SN',
        timestamp: 1710000000,
        close: 7200,
        previousClose: 7000,
        change: 200,
        change_p: 2.8571,
        volume: 12345,
      },
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
    axiosGet.mockResolvedValue({
      data: { code: 'CHILE.SN', close: 105, previousClose: 100 },
    });

    const quote = await provider.getQuote('CHILE.SN');

    expect(quote.change).toBe(5);
    expect(quote.changePercent).toBe(5);
  });

  it('maneja errores de API sin revelar secretos', async () => {
    axiosGet.mockRejectedValue(new Error('Request failed with status code 401'));

    await expect(provider.getQuote('CMPC.SN')).rejects.toThrow(
      'EODHD no pudo obtener CMPC.SN',
    );
  });

  it('ignora un ticker fallido y continua con los demas', async () => {
    axiosGet
      .mockResolvedValueOnce({ data: { code: 'COPEC.SN', close: 7200 } })
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ data: { code: 'CHILE.SN', close: 105 } });

    const quotes = await provider.getQuotes([
      'COPEC.SN',
      'FALLA.SN',
      'CHILE.SN',
    ]);

    expect(quotes.map((quote) => quote.symbol)).toEqual([
      'COPEC.SN',
      'CHILE.SN',
    ]);
    expect(axiosGet).toHaveBeenCalledTimes(3);
  });

  it('declares a daily refresh schedule', () => {
    const schedule = provider.getRefreshSchedule();
    expect(schedule).toBeDefined();
    expect(schedule!.cronExpression).toBe('0 30 18 * * 1-5');
  });
});

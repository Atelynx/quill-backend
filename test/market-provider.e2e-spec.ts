import type { INestApplication } from '@nestjs/common';
import { EODHDClient } from 'eodhd';
import request from 'supertest';
import {
  createTestApp,
  destroyTestApp,
  type TestAppContext,
} from './support/test-app';

jest.mock('eodhd');

interface StockQuoteResponse {
  symbol: string;
  close: number;
}

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

describe('Market providers (e2e)', () => {
  let testContext: TestAppContext | undefined;
  const mockRealTime = jest.fn();

  jest.setTimeout(120000);

  beforeEach(() => {
    jest.clearAllMocks();
    (EODHDClient as jest.Mock).mockImplementation(() => ({
      realTime: mockRealTime,
    }));
  });

  afterEach(async () => {
    if (testContext) {
      await destroyTestApp(testContext);
      testContext = undefined;
    }
  });

  it('responde endpoint de mercado con provider EODHD sin API real', async () => {
    mockRealTime.mockRejectedValue(new Error('No debe llamar API real en e2e'));
    testContext = await createTestApp({ marketProvider: 'eodhd' });

    const response = await request(getHttpServer(testContext.app))
      .get('/api/market/stocks')
      .expect(200);
    const quotes = response.body as StockQuoteResponse[];

    expect(quotes.map((quote) => quote.symbol)).toEqual([
      'BSANTANDER.SN',
      'CENCOSUD.SN',
      'CHILE.SN',
      'CMPC.SN',
      'COLBUN.SN',
      'COPEC.SN',
      'SQM-B.SN',
      'VAPORES.SN',
    ]);
    expect(mockRealTime).not.toHaveBeenCalled();
  });
});

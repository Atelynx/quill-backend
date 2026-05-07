import type { INestApplication } from '@nestjs/common';
import axios from 'axios';
import request from 'supertest';
import {
  createTestApp,
  destroyTestApp,
  type TestAppContext,
} from './support/test-app';

jest.mock('axios');

interface StockQuoteResponse {
  symbol: string;
  close: number;
}

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

describe('Market providers (e2e)', () => {
  let testContext: TestAppContext | undefined;

  jest.setTimeout(120000);

  afterEach(async () => {
    jest.restoreAllMocks();

    if (testContext) {
      await destroyTestApp(testContext);
      testContext = undefined;
    }
  });

  it('responde endpoint de mercado con provider EODHD sin API real', async () => {
    const axiosGet = axios.get as jest.Mock;
    axiosGet.mockRejectedValue(new Error('No debe llamar API real en e2e'));
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
    expect(axiosGet).not.toHaveBeenCalled();
  });
});

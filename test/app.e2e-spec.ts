import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { OrderExecutionService } from '../src/modules/orders/application/services/order-execution.service';
import {
  createTestApp,
  destroyTestApp,
  type TestAppContext,
} from './support/test-app';

interface HealthResponse {
  status: string;
  services: {
    mongodb: string;
    redis: string;
  };
  timestamp: string;
}

interface RegisterResponse {
  message: string;
  email: string;
  username: string;
}

interface LoginResponse {
  accessToken: string;
  user: {
    email: string;
    fullName: string;
    availableBalance: number;
    reservedBalance: number;
  };
}

interface StockQuoteResponse {
  symbol: string;
  close: number;
  currency?: string;
}

interface OrderResponse {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
  limitPrice: number;
  executionPrice?: number;
}

interface PortfolioResponse {
  positions: Array<{
    symbol: string;
    quantity: number;
  }>;
}

interface TradeResponse {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
}

interface OrderExecutionServiceTestApi {
  isMarketOpen(): Promise<boolean>;
}

function getHttpServer(app: INestApplication): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}

describe('Quill API (e2e)', () => {
  let app: INestApplication;
  let testContext: TestAppContext | undefined;
  let httpServer: Parameters<typeof request>[0];

  jest.setTimeout(120000);

  beforeAll(async () => {
    testContext = await createTestApp();
    app = testContext.app;
    httpServer = getHttpServer(app);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    if (testContext) {
      await destroyTestApp(testContext);
    }
  });

  it('responde con el estado de salud del sistema', async () => {
    const response = await request(httpServer)
      .get('/api/system/health')
      .expect(200);
    const body = response.body as HealthResponse;

    expect(body.services.mongodb).toBe('up');
    expect(['up', 'fallback']).toContain(body.services.redis);
    expect(body.status).toBe(body.services.redis === 'up' ? 'ok' : 'degraded');
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it('registra un usuario y rechaza correos duplicados', async () => {
    const payload = {
      fullName: 'Ana Lopez',
      email: 'ana.register@quill.dev',
      password: 'Password123',
    };

    const firstResponse = await request(httpServer)
      .post('/api/auth/register')
      .send(payload)
      .expect(201);
    const firstBody = firstResponse.body as RegisterResponse;

    expect(firstBody).toMatchObject({
      message: 'Cuenta creada correctamente. Inicia sesion para continuar.',
      email: payload.email,
    });
    expect(firstBody.username).toEqual(
      expect.stringMatching(/^user_[0-9a-f]{6}$/),
    );

    const duplicateResponse = await request(httpServer)
      .post('/api/auth/register')
      .send(payload)
      .expect(409);
    const duplicateBody = duplicateResponse.body as { message: string };

    expect(duplicateBody.message).toBe('Ya existe una cuenta con ese correo.');
  });

  it('permite iniciar sesion y rechaza credenciales invalidas', async () => {
    const payload = {
      fullName: 'Luis Perez',
      email: 'luis.login@quill.dev',
      password: 'Password123',
    };

    await request(httpServer)
      .post('/api/auth/register')
      .send(payload)
      .expect(201);

    const loginResponse = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: payload.email,
        password: payload.password,
      })
      .expect(201);
    const loginBody = loginResponse.body as LoginResponse;

    expect(loginBody.accessToken).toEqual(expect.any(String));
    expect(loginBody.user).toMatchObject({
      email: payload.email,
      fullName: payload.fullName,
      availableBalance: 100000,
      reservedBalance: 0,
    });

    const invalidResponse = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: payload.email,
        password: 'WrongPassword123',
      })
      .expect(401);
    const invalidBody = invalidResponse.body as { message: string };

    expect(invalidBody.message).toBe('Credenciales inválidas.');
  });

  it('crea una orden y la ejecuta cuando el mercado cumple la condicion', async () => {
    const credentials = {
      fullName: 'Sofia Martinez',
      email: 'sofia.orders@quill.dev',
      password: 'Password123',
    };

    await request(httpServer)
      .post('/api/auth/register')
      .send(credentials)
      .expect(201);

    const loginResponse = await request(httpServer)
      .post('/api/auth/login')
      .send({
        email: credentials.email,
        password: credentials.password,
      })
      .expect(201);
    const loginBody = loginResponse.body as LoginResponse;

    const token = loginBody.accessToken;
    await testContext!.connection.collection('stocks').insertOne({
      symbol: 'E2ECLP',
      name: 'Acción CLP E2E',
      currency: 'CLP',
      close: 1000,
      previousClose: 1000,
      dayChangePercentage: 0,
      source: 'admin',
      baseVolatility: 0,
      baseDrift: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const quotesResponse = await request(httpServer)
      .get('/api/market/stocks')
      .expect(200);
    const quotes = quotesResponse.body as StockQuoteResponse[];
    const targetQuote = quotes.find(
      (quote) => quote.symbol === 'E2ECLP' && quote.currency === 'CLP',
    );

    expect(targetQuote).toBeDefined();
    if (!targetQuote) {
      throw new Error('No se encontro una accion CLP valida para el e2e.');
    }

    const orderResponse = await request(httpServer)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        symbol: targetQuote.symbol,
        side: 'BUY',
        quantity: 2,
        limitPrice: Number((targetQuote.close + 5).toFixed(2)),
      })
      .expect(201);
    const orderBody = orderResponse.body as OrderResponse;

    expect(orderBody).toMatchObject({
      symbol: targetQuote.symbol,
      side: 'BUY',
      quantity: 2,
      status: 'PENDING',
    });

    const executionService = app.get(OrderExecutionService);
    jest
      .spyOn(
        executionService as unknown as OrderExecutionServiceTestApi,
        'isMarketOpen',
      )
      .mockResolvedValue(true);
    await executionService.handleMarketTick();

    const executedOrdersResponse = await request(httpServer)
      .get('/api/orders')
      .query({ status: 'executed' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const executedOrders = executedOrdersResponse.body as OrderResponse[];

    expect(executedOrders).toHaveLength(1);
    expect(executedOrders[0]).toMatchObject({
      symbol: targetQuote.symbol,
      side: 'BUY',
      quantity: 2,
      status: 'EXECUTED',
    });
    expect(executedOrders[0].executionPrice).toBeLessThanOrEqual(
      orderBody.limitPrice,
    );

    const portfolioResponse = await request(httpServer)
      .get('/api/portfolio/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const portfolioBody = portfolioResponse.body as PortfolioResponse;

    expect(portfolioBody.positions).toEqual([
      expect.objectContaining({
        symbol: targetQuote.symbol,
        quantity: 2,
      }),
    ]);

    const tradesResponse = await request(httpServer)
      .get('/api/trades')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const trades = tradesResponse.body as TradeResponse[];

    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      symbol: targetQuote.symbol,
      side: 'BUY',
      quantity: 2,
    });
  });
});

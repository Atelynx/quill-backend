import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MarketRefreshService } from '../src/modules/market/application/services/market-refresh.service';
import { MarketService } from '../src/modules/market/application/services/market.service';
import { OrderExecutionService } from '../src/modules/orders/application/services/order-execution.service';
import {
  createTestApp,
  destroyTestApp,
  type TestAppContext,
} from './support/test-app';
import {
  createPosition,
  createStock,
  getFinancialModels,
  registerAndLogin,
} from './support/order-financial-fixtures';

jest.setTimeout(120000);

describe('Order financial flows (e2e)', () => {
  let app: INestApplication;
  let testContext: TestAppContext | undefined;

  beforeAll(async () => {
    testContext = await createTestApp();
    app = testContext.app;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (testContext) {
      await testContext.connection.dropDatabase();
    }
  });

  afterAll(async () => {
    if (testContext) {
      await destroyTestApp(testContext);
    }
  });

  it('reserva acciones y ejecuta una venta con comision y cotizacion persistida', async () => {
    await createStock(app, 'SELL.SN', 101.12);
    const { token, user, server } = await registerAndLogin(app, 'sell.flow@quill.dev');
    await createPosition(app, user._id, 'SELL.SN', 5);

    await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'SELL.SN', side: 'SELL', quantity: 2, limitPrice: 100 })
      .expect(201);

    const { orderModel, positionModel, tradeModel, userModel } =
      getFinancialModels(app);
    await expect(positionModel.findOne({ symbol: 'SELL.SN' }).lean()).resolves
      .toMatchObject({ quantity: 5, reservedQuantity: 2 });

    const marketService = app.get(MarketService);
    const refreshService = app.get(MarketRefreshService);
    const listQuotesSpy = jest.spyOn(marketService, 'listQuotes');
    const refreshSpy = jest.spyOn(marketService, 'refreshMarket');
    const externalRefreshSpy = jest.spyOn(refreshService, 'refreshMarket');

    await (app.get(OrderExecutionService) as any).executeCycle();

    expect(listQuotesSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(externalRefreshSpy).not.toHaveBeenCalled();

    await expect(positionModel.findOne({ symbol: 'SELL.SN' }).lean()).resolves
      .toMatchObject({ quantity: 3, reservedQuantity: 0 });
    await expect(userModel.findById(user._id).lean()).resolves.toMatchObject({
      availableBalance: 100201.23,
      reservedBalance: 0,
    });

    await expect(orderModel.findOne({ symbol: 'SELL.SN' }).lean()).resolves
      .toMatchObject({
        status: 'EXECUTED',
        executionPrice: 101.12,
        commissionAmount: 1.01,
      });
    await expect(tradeModel.findOne({ symbol: 'SELL.SN' }).lean()).resolves
      .toMatchObject({ side: 'SELL', grossAmount: 202.24, netAmount: 201.23 });
  });

  it('rechaza compra sin saldo y venta sin acciones sin dejar estado parcial', async () => {
    await createStock(app, 'BUY.SN', 50);
    const { token, user, server } = await registerAndLogin(app, 'reject.flow@quill.dev');
    const { orderModel, positionModel, tradeModel, userModel } =
      getFinancialModels(app);
    await userModel.findByIdAndUpdate(user._id, { availableBalance: 100 });

    await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'BUY.SN', side: 'BUY', quantity: 3, limitPrice: 50 })
      .expect(400);

    await expect(orderModel.countDocuments()).resolves.toBe(0);
    await expect(tradeModel.countDocuments()).resolves.toBe(0);
    await expect(userModel.findById(user._id).lean()).resolves.toMatchObject({
      availableBalance: 100,
      reservedBalance: 0,
    });

    await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'BUY.SN', side: 'SELL', quantity: 1, limitPrice: 45 })
      .expect(400);

    await expect(positionModel.countDocuments()).resolves.toBe(0);
    await expect(orderModel.countDocuments()).resolves.toBe(0);
    await expect(tradeModel.countDocuments()).resolves.toBe(0);
  });

  it('revierte la ejecucion si falla la creacion del trade', async () => {
    await createStock(app, 'ROLLBACK.SN', 25);
    const { token, user, server } = await registerAndLogin(app, 'rollback.flow@quill.dev');
    await createPosition(app, user._id, 'ROLLBACK.SN', 4);
    await request(server)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ symbol: 'ROLLBACK.SN', side: 'SELL', quantity: 2, limitPrice: 20 })
      .expect(201);

    const { orderModel, positionModel, tradeModel, userModel } =
      getFinancialModels(app);
    jest
      .spyOn(tradeModel, 'create')
      .mockRejectedValueOnce(new Error('Falla controlada de trade.'));

    await (app.get(OrderExecutionService) as any).executeCycle();

    await expect(orderModel.findOne({ symbol: 'ROLLBACK.SN' }).lean()).resolves
      .toMatchObject({ status: 'PENDING' });
    await expect(positionModel.findOne({ symbol: 'ROLLBACK.SN' }).lean())
      .resolves.toMatchObject({ quantity: 4, reservedQuantity: 2 });
    await expect(userModel.findById(user._id).lean()).resolves.toMatchObject({
      availableBalance: 100000,
      reservedBalance: 0,
    });
    expect(await tradeModel.countDocuments()).toBe(0);
  });
});

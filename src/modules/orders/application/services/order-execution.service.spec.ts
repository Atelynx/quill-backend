import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrderExecutionService } from './order-execution.service';

interface ServiceInternals {
  logger: Logger;
  executeCycle(): Promise<void>;
  executeMarketOrder(
    userId: string,
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
  ): Promise<unknown>;
  handleMarketTick(): Promise<void>;
}

interface SessionMock {
  withTransaction: jest.Mock;
  endSession: jest.Mock;
}

interface OrderMock {
  id: string;
  userId: Types.ObjectId;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  limitPrice: number;
  reservedAmount: number;
  status: string;
  executionPrice?: number;
  commissionAmount?: number;
  save: jest.Mock;
}

interface ModelMock {
  find: jest.Mock;
  findById: jest.Mock;
}

const query = <T>(value: T) => ({
  session: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

describe('OrderExecutionService', () => {
  let service: ServiceInternals;
  let marketService: { listQuotes: jest.Mock };
  let session: SessionMock;
  let orderModel: ModelMock;
  let userModel: { findById: jest.Mock };
  let positionModel: { findOne: jest.Mock; create: jest.Mock };
  let stockModel: { findOne: jest.Mock };
  let tradeModel: { create: jest.Mock };
  let commissionService: { calculate: jest.Mock };
  let currencyRateService: { getRate: jest.Mock };
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    marketService = { listQuotes: jest.fn() };
    session = {
      withTransaction: jest.fn((callback: () => Promise<unknown>) =>
        callback(),
      ),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    orderModel = { find: jest.fn(), findById: jest.fn() };
    userModel = { findById: jest.fn() };
    positionModel = { findOne: jest.fn(), create: jest.fn() };
    stockModel = { findOne: jest.fn() };
    stockModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ currency: 'CLP' }),
      }),
    });
    tradeModel = { create: jest.fn().mockResolvedValue(undefined) };
    commissionService = { calculate: jest.fn() };
    currencyRateService = { getRate: jest.fn() };
    service = new OrderExecutionService(
      {} as never,
      marketService as never,
      { startSession: jest.fn().mockResolvedValue(session) } as never,
      orderModel as never,
      userModel as never,
      positionModel as never,
      stockModel as never,
      tradeModel as never,
      commissionService as never,
      { get: jest.fn() } as never,
      { get: jest.fn() } as never,
      currencyRateService as never,
    ) as unknown as ServiceInternals;
    errorSpy = jest
      .spyOn(service.logger, 'error')
      .mockImplementation(jest.fn());
  });

  const order = (
    side: 'BUY' | 'SELL',
    overrides: Partial<OrderMock> = {},
  ): OrderMock => ({
    id: new Types.ObjectId().toString(),
    userId: new Types.ObjectId(),
    symbol: `${side}.SN`,
    side,
    quantity: 2,
    limitPrice: side === 'BUY' ? 100 : 90,
    reservedAmount: side === 'BUY' ? 202.5 : 0,
    status: 'PENDING',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  async function executeWith(
    currentOrder: OrderMock,
    price: number,
    liveOrder = currentOrder,
    currency?: string,
  ): Promise<void> {
    marketService.listQuotes.mockResolvedValue([
      { symbol: currentOrder.symbol, close: price, currency },
    ]);
    orderModel.find.mockReturnValue(query([currentOrder]));
    orderModel.findById.mockReturnValue(query(liveOrder));
    await service.executeCycle();
  }

  it('ejecuta una compra y actualiza una posicion existente', async () => {
    const currentOrder = order('BUY');
    const user = {
      id: currentOrder.userId.toString(),
      availableBalance: 797.5,
      reservedBalance: 202.5,
      save: jest.fn(),
    };
    const position = { quantity: 3, averageCost: 80, save: jest.fn() };
    userModel.findById.mockReturnValue(query(user));
    positionModel.findOne.mockReturnValue(query(position));
    commissionService.calculate.mockResolvedValue(1);

    await executeWith(currentOrder, 100);

    expect(user).toMatchObject({ availableBalance: 799, reservedBalance: 0 });
    expect(position).toMatchObject({ quantity: 5, averageCost: 88 });
    expect(currentOrder).toMatchObject({
      status: 'EXECUTED',
      executionPrice: 100,
      commissionAmount: 1,
    });
    expect(tradeModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          side: 'BUY',
          grossAmount: 200,
          netAmount: 201,
        }),
      ],
      { session },
    );
  });

  it('crea una posicion nueva cuando compra sin posicion previa', async () => {
    const currentOrder = order('BUY', { symbol: 'NEW.SN' });
    userModel.findById.mockReturnValue(
      query({
        id: currentOrder.userId.toString(),
        availableBalance: 400,
        reservedBalance: 202.5,
        save: jest.fn(),
      }),
    );
    positionModel.findOne.mockReturnValue(query(null));
    commissionService.calculate.mockResolvedValue(1);

    await executeWith(currentOrder, 100);

    expect(positionModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          symbol: 'NEW.SN',
          quantity: 2,
          averageCost: 100,
        }),
      ],
      { session },
    );
  });

  it('convierte una orden extranjera con una tasa valida', async () => {
    const currentOrder = order('BUY', { symbol: 'AAPL.US' });
    const user = {
      id: currentOrder.userId.toString(),
      availableBalance: 1000,
      reservedBalance: 202.5,
      save: jest.fn(),
    };
    userModel.findById.mockReturnValue(query(user));
    positionModel.findOne.mockReturnValue(query(null));
    currencyRateService.getRate.mockResolvedValue({ rate: 900 });
    commissionService.calculate
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    await executeWith(currentOrder, 1, currentOrder, 'USD');

    expect(currencyRateService.getRate).toHaveBeenCalledWith('USDCLP');
    expect(user.availableBalance).toBe(-599.5);
  });

  it.each([null, { rate: 0 }, { rate: -1 }, { rate: Number.NaN }])(
    'mantiene pendiente una orden extranjera sin tasa valida',
    async (rate) => {
      const currentOrder = order('BUY', { symbol: 'AAPL.US' });
      userModel.findById.mockReturnValue(
        query({
          id: currentOrder.userId.toString(),
          availableBalance: 1000,
          reservedBalance: 202.5,
          save: jest.fn(),
        }),
      );
      currencyRateService.getRate.mockResolvedValue(rate);
      commissionService.calculate.mockResolvedValue(1);

      await executeWith(currentOrder, 1, currentOrder, 'USD');

      expect(currentOrder.status).toBe('PENDING');
      expect(tradeModel.create).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();
    },
  );

  it('consulta la moneda del activo cuando la cotizacion no la informa', async () => {
    const currentOrder = order('BUY', { symbol: 'AAPL.US' });
    stockModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ currency: 'USD' }),
      }),
    });
    currencyRateService.getRate.mockResolvedValue(null);

    await executeWith(currentOrder, 1, currentOrder, undefined);

    expect(stockModel.findOne).toHaveBeenCalledWith({ symbol: 'AAPL.US' });
    expect(currentOrder.status).toBe('PENDING');
  });

  it('ejecuta ventas parciales y totales liberando reservas', async () => {
    const currentOrder = order('SELL');
    const user = {
      id: currentOrder.userId.toString(),
      availableBalance: 1000,
      save: jest.fn(),
    };
    const position = {
      quantity: 5,
      reservedQuantity: 2,
      save: jest.fn(),
      deleteOne: jest.fn(),
    };
    userModel.findById.mockReturnValue(query(user));
    positionModel.findOne.mockReturnValueOnce(query(position));
    commissionService.calculate.mockResolvedValue(1.01);

    await executeWith(currentOrder, 101.12);

    expect(user.availableBalance).toBe(1201.23);
    expect(position).toMatchObject({ quantity: 3, reservedQuantity: 0 });
    expect(position.save).toHaveBeenCalledWith({ session });
    expect(tradeModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          side: 'SELL',
          grossAmount: 202.24,
          netAmount: 201.23,
        }),
      ],
      { session },
    );

    positionModel.findOne.mockReturnValueOnce(
      query({
        quantity: 2,
        reservedQuantity: 2,
        deleteOne: position.deleteOne,
      }),
    );
    await executeWith(order('SELL'), 100);
    expect(position.deleteOne).toHaveBeenCalledWith({ session });
  });

  it('omite ordenes no ejecutables o ya procesadas', async () => {
    const buy = order('BUY', { limitPrice: 90 });
    marketService.listQuotes.mockResolvedValue([
      { symbol: buy.symbol, close: 100 },
    ]);
    orderModel.find.mockReturnValue(
      query([buy, order('SELL', { symbol: 'MISS.SN' })]),
    );
    await service.executeCycle();
    expect(orderModel.findById).not.toHaveBeenCalled();

    userModel.findById.mockReturnValue(query({ id: buy.userId.toString() }));
    await executeWith(buy, 80, { ...buy, status: 'EXECUTED' });
    expect(session.endSession).toHaveBeenCalled();
    expect(commissionService.calculate).not.toHaveBeenCalled();
  });

  it('libera el ciclo del cron aunque falle la ejecucion', async () => {
    marketService.listQuotes.mockRejectedValueOnce(
      new Error('Falla controlada.'),
    );
    await service.handleMarketTick();
    await service.handleMarketTick();
    expect(marketService.listQuotes).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('executeMarketOrder', () => {
  let service: ServiceInternals;
  let cacheService: { get: jest.Mock };
  let stockModel: { findOne: jest.Mock };
  let session: { withTransaction: jest.Mock; endSession: jest.Mock };
  let orderModel: { find: jest.Mock; findById: jest.Mock; create: jest.Mock };
  let userModel: { findById: jest.Mock };
  let positionModel: { findOne: jest.Mock; create: jest.Mock };
  let tradeModel: { create: jest.Mock };
  let commissionService: { calculate: jest.Mock };
  let currencyRateService: { getRate: jest.Mock };
  let errorSpy: jest.SpyInstance;

  const orderId = new Types.ObjectId().toString();
  const userId = new Types.ObjectId().toString();
  const baseUser = () => ({
    id: userId,
    availableBalance: 1000,
    reservedBalance: 0,
    save: jest.fn(),
  });

  beforeEach(() => {
    session = {
      withTransaction: jest.fn((callback: () => Promise<unknown>) =>
        callback(),
      ),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    stockModel = { findOne: jest.fn() };
    orderModel = {
      find: jest.fn(),
      findById: jest.fn(),
      create: jest.fn().mockResolvedValue([{ id: orderId }]),
    };
    userModel = { findById: jest.fn() };
    positionModel = { findOne: jest.fn(), create: jest.fn() };
    tradeModel = { create: jest.fn().mockResolvedValue(undefined) };
    commissionService = { calculate: jest.fn().mockResolvedValue(1) };
    cacheService = { get: jest.fn() };
    currencyRateService = { getRate: jest.fn() };

    const leanExec = <T>(value: T) => ({
      lean: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(value) }),
    });
    stockModel.findOne.mockReturnValue(
      leanExec({ symbol: 'AAPL', currency: 'CLP' }),
    );

    service = new OrderExecutionService(
      {} as never,
      { listQuotes: jest.fn() } as never,
      { startSession: jest.fn().mockResolvedValue(session) } as never,
      orderModel as never,
      userModel as never,
      positionModel as never,
      stockModel as never,
      tradeModel as never,
      commissionService as never,
      { get: jest.fn() } as never,
      cacheService as never,
      currencyRateService as never,
    ) as unknown as ServiceInternals;
    errorSpy = jest
      .spyOn(service.logger, 'error')
      .mockImplementation(jest.fn());
  });

  it('lanza NotFoundException cuando no hay precio en vivo', async () => {
    cacheService.get.mockResolvedValue(undefined);

    await expect(
      service.executeMarketOrder(userId, 'AAPL', 'BUY', 10),
    ).rejects.toThrow(NotFoundException);

    expect(cacheService.get).toHaveBeenCalledWith('stock:AAPL:live_price');
  });

  it('lanza NotFoundException cuando el usuario no existe', async () => {
    cacheService.get.mockResolvedValue(150);
    userModel.findById.mockReturnValue(query(null));

    await expect(
      service.executeMarketOrder(userId, 'AAPL', 'BUY', 10),
    ).rejects.toThrow(NotFoundException);
  });

  it('lanza BadRequestException para BUY cuando no hay saldo suficiente', async () => {
    cacheService.get.mockResolvedValue(150);
    const user = baseUser();
    user.availableBalance = 10;
    userModel.findById.mockReturnValue(query(user));

    await expect(
      service.executeMarketOrder(userId, 'AAPL', 'BUY', 10),
    ).rejects.toThrow(BadRequestException);
  });

  it.each([null, { rate: 0 }, { rate: -1 }, { rate: Number.NaN }])(
    'rechaza una orden MARKET extranjera sin tasa valida',
    async (rate) => {
      cacheService.get.mockResolvedValue(100);
      stockModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest
            .fn()
            .mockResolvedValue({ symbol: 'AAPL', currency: 'USD' }),
        }),
      });
      currencyRateService.getRate.mockResolvedValue(rate);

      await expect(
        service.executeMarketOrder(userId, 'AAPL', 'BUY', 1),
      ).rejects.toThrow(BadRequestException);

      expect(session.withTransaction).not.toHaveBeenCalled();
    },
  );

  it('BUY crea una nueva posicion cuando no existe previamente', async () => {
    cacheService.get.mockResolvedValue(100);
    const user = baseUser();
    userModel.findById.mockReturnValue(query(user));
    positionModel.findOne.mockReturnValue(query(null));

    const result = await service.executeMarketOrder(userId, 'NEW', 'BUY', 5);

    expect(user.availableBalance).toBe(499);
    expect(user.save).toHaveBeenCalled();
    expect(positionModel.create).toHaveBeenCalledWith(
      [
        {
          userId: new Types.ObjectId(userId),
          symbol: 'NEW',
          quantity: 5,
          reservedQuantity: 0,
          averageCost: 100,
        },
      ],
      { session },
    );
    expect(result).toBeDefined();
    expect(tradeModel.create).toHaveBeenCalled();
  });

  it('BUY actualiza una posicion existente con nuevo costo promedio', async () => {
    cacheService.get.mockResolvedValue(100);
    const user = baseUser();
    userModel.findById.mockReturnValue(query(user));
    const existingPosition = { quantity: 3, averageCost: 80, save: jest.fn() };
    positionModel.findOne.mockReturnValue(query(existingPosition));

    await service.executeMarketOrder(userId, 'AAPL', 'BUY', 5);

    expect(existingPosition.quantity).toBe(8);
    expect(existingPosition.averageCost).toBe(92.5);
    expect(existingPosition.save).toHaveBeenCalledWith({ session });
    expect(user.availableBalance).toBe(499);
  });

  it('lanza BadRequestException para SELL cuando no hay posicion', async () => {
    cacheService.get.mockResolvedValue(100);
    userModel.findById.mockReturnValue(query(baseUser()));
    positionModel.findOne.mockReturnValue(query(null));

    await expect(
      service.executeMarketOrder(userId, 'MISS', 'SELL', 5),
    ).rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequestException para SELL cuando la cantidad es insuficiente', async () => {
    cacheService.get.mockResolvedValue(100);
    userModel.findById.mockReturnValue(query(baseUser()));
    positionModel.findOne.mockReturnValue(query({ quantity: 2 }));

    await expect(
      service.executeMarketOrder(userId, 'AAPL', 'SELL', 5),
    ).rejects.toThrow(BadRequestException);
  });

  it('SELL parcial mantiene la posicion si aun quedan acciones', async () => {
    cacheService.get.mockResolvedValue(100);
    const user = baseUser();
    userModel.findById.mockReturnValue(query(user));
    const position = { quantity: 5, save: jest.fn(), deleteOne: jest.fn() };
    positionModel.findOne.mockReturnValue(query(position));

    await service.executeMarketOrder(userId, 'AAPL', 'SELL', 3);

    expect(position.quantity).toBe(2);
    expect(position.save).toHaveBeenCalledWith({ session });
    expect(position.deleteOne).not.toHaveBeenCalled();
    expect(user.availableBalance).toBe(1299);
  });

  it('registra y re-lanza errores inesperados de sesion', async () => {
    cacheService.get.mockResolvedValue(100);
    const unexpectedError = new Error('DB timeout');
    session.withTransaction.mockRejectedValue(unexpectedError);

    await expect(
      service.executeMarketOrder(userId, 'AAPL', 'BUY', 5),
    ).rejects.toThrow('DB timeout');

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to execute market order for AAPL',
      unexpectedError,
    );
    expect(session.endSession).toHaveBeenCalled();
  });

  it('SELL total elimina la posicion si quantity llega a 0', async () => {
    cacheService.get.mockResolvedValue(100);
    const user = baseUser();
    userModel.findById.mockReturnValue(query(user));
    const position = { quantity: 5, save: jest.fn(), deleteOne: jest.fn() };
    positionModel.findOne.mockReturnValue(query(position));

    await service.executeMarketOrder(userId, 'AAPL', 'SELL', 5);

    expect(position.deleteOne).toHaveBeenCalledWith({ session });
    expect(position.save).not.toHaveBeenCalled();
    expect(user.availableBalance).toBe(1499);
  });
});

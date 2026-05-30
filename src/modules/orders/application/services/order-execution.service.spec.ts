import { Types } from 'mongoose';
import { OrderExecutionService } from './order-execution.service';

const query = <T>(value: T) => ({
  session: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

describe('OrderExecutionService', () => {
  let service: any, marketService: any, session: any, orderModel: any;
  let userModel: any, positionModel: any, tradeModel: any, commissionService: any;

  beforeEach(() => {
    marketService = { listQuotes: jest.fn() };
    session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    orderModel = { find: jest.fn(), findById: jest.fn() };
    userModel = { findById: jest.fn() };
    positionModel = { findOne: jest.fn(), create: jest.fn() };
    tradeModel = { create: jest.fn().mockResolvedValue(undefined) };
    commissionService = { calculate: jest.fn() };
    service = new OrderExecutionService(
      {} as never,
      marketService,
      { startSession: jest.fn().mockResolvedValue(session) } as never,
      orderModel,
      userModel,
      positionModel,
      tradeModel,
      commissionService,
      { get: jest.fn() } as never,
    );
    jest.spyOn(service.logger, 'error').mockImplementation(jest.fn());
  });

  const order = (side: 'BUY' | 'SELL', overrides = {}) => ({
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

  async function executeWith(currentOrder: any, price: number, liveOrder = currentOrder) {
    marketService.listQuotes.mockResolvedValue([{ symbol: currentOrder.symbol, close: price }]);
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
    commissionService.calculate.mockReturnValue(1);

    await executeWith(currentOrder, 100);

    expect(user).toMatchObject({ availableBalance: 799, reservedBalance: 0 });
    expect(position).toMatchObject({ quantity: 5, averageCost: 88 });
    expect(currentOrder).toMatchObject({
      status: 'EXECUTED',
      executionPrice: 100,
      commissionAmount: 1,
    });
    expect(tradeModel.create).toHaveBeenCalledWith(
      [expect.objectContaining({ side: 'BUY', grossAmount: 200, netAmount: 201 })],
      { session },
    );
  });

  it('crea una posicion nueva cuando compra sin posicion previa', async () => {
    const currentOrder = order('BUY', { symbol: 'NEW.SN' });
    userModel.findById.mockReturnValue(query({
      id: currentOrder.userId.toString(),
      availableBalance: 400,
      reservedBalance: 202.5,
      save: jest.fn(),
    }));
    positionModel.findOne.mockReturnValue(query(null));
    commissionService.calculate.mockReturnValue(1);

    await executeWith(currentOrder, 100);

    expect(positionModel.create).toHaveBeenCalledWith(
      [expect.objectContaining({ symbol: 'NEW.SN', quantity: 2, averageCost: 100 })],
      { session },
    );
  });

  it('ejecuta ventas parciales y totales liberando reservas', async () => {
    const currentOrder = order('SELL');
    const user = { id: currentOrder.userId.toString(), availableBalance: 1000, save: jest.fn() };
    const position = { quantity: 5, reservedQuantity: 2, save: jest.fn(), deleteOne: jest.fn() };
    userModel.findById.mockReturnValue(query(user));
    positionModel.findOne.mockReturnValueOnce(query(position));
    commissionService.calculate.mockReturnValue(1.01);

    await executeWith(currentOrder, 101.12);

    expect(user.availableBalance).toBe(1201.23);
    expect(position).toMatchObject({ quantity: 3, reservedQuantity: 0 });
    expect(position.save).toHaveBeenCalledWith({ session });
    expect(tradeModel.create).toHaveBeenCalledWith(
      [expect.objectContaining({ side: 'SELL', grossAmount: 202.24, netAmount: 201.23 })],
      { session },
    );

    positionModel.findOne.mockReturnValueOnce(
      query({ quantity: 2, reservedQuantity: 2, deleteOne: position.deleteOne }),
    );
    await executeWith(order('SELL'), 100);
    expect(position.deleteOne).toHaveBeenCalledWith({ session });
  });

  it('omite ordenes no ejecutables o ya procesadas', async () => {
    const buy = order('BUY', { limitPrice: 90 });
    marketService.listQuotes.mockResolvedValue([{ symbol: buy.symbol, close: 100 }]);
    orderModel.find.mockReturnValue(query([buy, order('SELL', { symbol: 'MISS.SN' })]));
    await service.executeCycle();
    expect(orderModel.findById).not.toHaveBeenCalled();

    userModel.findById.mockReturnValue(query({ id: buy.userId.toString() }));
    await executeWith(buy, 80, { ...buy, status: 'EXECUTED' });
    expect(session.endSession).toHaveBeenCalled();
    expect(commissionService.calculate).not.toHaveBeenCalled();
  });

  it('libera el ciclo del cron aunque falle la ejecucion', async () => {
    marketService.listQuotes.mockRejectedValueOnce(new Error('Falla controlada.'));
    await service.handleMarketTick();
    await service.handleMarketTick();
    expect(marketService.listQuotes).toHaveBeenCalledTimes(2);
    expect(service.logger.error).toHaveBeenCalled();
  });
});

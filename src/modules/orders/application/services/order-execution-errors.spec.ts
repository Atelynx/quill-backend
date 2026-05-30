import { Types } from 'mongoose';
import { OrderExecutionService } from './order-execution.service';

const query = <T>(value: T) => ({
  session: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

describe('OrderExecutionService error paths', () => {
  let service: any;
  let marketService: any;
  let session: any;
  let orderModel: any;
  let userModel: any;
  let positionModel: any;

  beforeEach(() => {
    marketService = { listQuotes: jest.fn() };
    session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    orderModel = { find: jest.fn(), findById: jest.fn() };
    userModel = { findById: jest.fn() };
    positionModel = { findOne: jest.fn(), create: jest.fn() };
    service = new OrderExecutionService(
      {} as never,
      marketService,
      { startSession: jest.fn().mockResolvedValue(session) } as never,
      orderModel,
      userModel,
      positionModel,
      { create: jest.fn() } as never,
      { calculate: jest.fn().mockReturnValue(1) } as never,
    );
    jest.spyOn(service.logger, 'error').mockImplementation(jest.fn());
  });

  it('omite el tick cuando ya existe un ciclo en curso', async () => {
    service.isRunning = true;

    await service.handleMarketTick();

    expect(marketService.listQuotes).not.toHaveBeenCalled();
  });

  it('registra el error cuando una venta no encuentra posicion', async () => {
    const order = {
      id: new Types.ObjectId().toString(),
      userId: new Types.ObjectId(),
      symbol: 'NO-POS.SN',
      side: 'SELL',
      quantity: 1,
      limitPrice: 10,
      status: 'PENDING',
      save: jest.fn(),
    };
    marketService.listQuotes.mockResolvedValue([
      { symbol: order.symbol, close: 10 },
    ]);
    orderModel.find.mockReturnValue(query([order]));
    orderModel.findById.mockReturnValue(query(order));
    userModel.findById.mockReturnValue(query({
      id: order.userId.toString(),
      availableBalance: 0,
      save: jest.fn(),
    }));
    positionModel.findOne.mockReturnValue(query(null));

    await service.executeCycle();

    expect(service.logger.error).toHaveBeenCalledWith(
      `Failed to execute order ${order.id}`,
      expect.any(Error),
    );
    expect(session.endSession).toHaveBeenCalled();
  });
});

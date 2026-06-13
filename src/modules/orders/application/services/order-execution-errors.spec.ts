import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrderExecutionService } from './order-execution.service';

interface ServiceInternals {
  isRunning: boolean;
  logger: Logger;
  executeCycle(): Promise<void>;
  handleMarketTick(): Promise<void>;
}

const query = <T>(value: T) => ({
  session: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

describe('OrderExecutionService error paths', () => {
  let service: ServiceInternals;
  let marketService: { listQuotes: jest.Mock };
  let session: { withTransaction: jest.Mock; endSession: jest.Mock };
  let orderModel: { find: jest.Mock; findById: jest.Mock };
  let userModel: { findById: jest.Mock };
  let positionModel: { findOne: jest.Mock; create: jest.Mock };
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
    service = new OrderExecutionService(
      {} as never,
      marketService as never,
      { startSession: jest.fn().mockResolvedValue(session) } as never,
      orderModel as never,
      userModel as never,
      positionModel as never,
      {
        findOne: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue({ currency: 'CLP' }),
          }),
        }),
      } as never,
      { create: jest.fn() } as never,
      { calculate: jest.fn().mockResolvedValue(1) } as never,
      { get: jest.fn() } as never,
      { get: jest.fn() } as never,
      { getRate: jest.fn() } as never,
    ) as unknown as ServiceInternals;
    errorSpy = jest
      .spyOn(service.logger, 'error')
      .mockImplementation(jest.fn());
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
    userModel.findById.mockReturnValue(
      query({
        id: order.userId.toString(),
        availableBalance: 0,
        save: jest.fn(),
      }),
    );
    positionModel.findOne.mockReturnValue(query(null));

    await service.executeCycle();

    expect(errorSpy).toHaveBeenCalledWith(
      `Failed to execute order ${order.id}`,
      expect.any(Error),
    );
    expect(session.endSession).toHaveBeenCalled();
  });
});

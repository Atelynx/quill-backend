import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrdersService } from './orders.service';

const query = <T>(value: T) => ({
  session: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

describe('OrdersService edge cases', () => {
  let service: OrdersService;
  let orderModel: { create: jest.Mock; find: jest.Mock };
  let userModel: { findById: jest.Mock };
  let stockModel: { findOneAndUpdate: jest.Mock };

  beforeEach(() => {
    orderModel = { create: jest.fn(), find: jest.fn() };
    userModel = { findById: jest.fn() };
    stockModel = { findOneAndUpdate: jest.fn() };
    service = new OrdersService(
      {
        startSession: jest.fn().mockResolvedValue({
          withTransaction: jest.fn((callback: () => Promise<unknown>) =>
            callback(),
          ),
          endSession: jest.fn(),
        }),
      } as never,
      orderModel as never,
      userModel as never,
      { findOne: jest.fn() } as never,
      stockModel as never,
      { calculate: jest.fn() } as never,
      { executeMarketOrder: jest.fn() } as never,
      { getRate: jest.fn() } as never,
    );
  });

  it('rechaza ordenes sin usuario, sin accion o sin cantidad entera positiva', async () => {
    const userId = new Types.ObjectId().toString();
    const dto = {
      symbol: 'AAPL',
      side: 'BUY' as const,
      quantity: 1,
      limitPrice: 10,
    };
    userModel.findById.mockReturnValueOnce(query(null));
    stockModel.findOneAndUpdate.mockResolvedValueOnce({ symbol: 'AAPL' });

    await expect(service.createOrder(userId, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    userModel.findById.mockReturnValueOnce(query({ availableBalance: 100 }));
    stockModel.findOneAndUpdate.mockResolvedValueOnce(null);
    await expect(service.createOrder(userId, dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    userModel.findById.mockReturnValueOnce(query({ availableBalance: 100 }));
    stockModel.findOneAndUpdate.mockResolvedValueOnce({ symbol: 'AAPL' });
    await expect(
      service.createOrder(userId, { ...dto, quantity: 0.9 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orderModel.create).not.toHaveBeenCalled();
  });

  it('lista ordenes del usuario con estado normalizado cuando viene informado', async () => {
    const orders = [{ id: 'order-1' }];
    const exec = jest.fn().mockResolvedValue(orders);
    const lean = jest.fn().mockReturnValue({ exec });
    const sort = jest.fn().mockReturnValue({ lean });
    orderModel.find.mockReturnValue({ sort });

    await expect(
      service.listUserOrders(new Types.ObjectId().toString(), 'pending'),
    ).resolves.toBe(orders);

    expect(orderModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING' }),
    );
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });
});

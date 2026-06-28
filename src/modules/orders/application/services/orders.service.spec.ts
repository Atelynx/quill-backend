import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateOrderDto } from '../../presentation/dto/create-order.dto';
import { OrdersService } from './orders.service';

function createExecQuery<T>(value: T) {
  return {
    session: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('OrdersService', () => {
  let service: OrdersService;
  let orderModel: {
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let userModel: {
    findById: jest.Mock;
  };
  let positionModel: {
    findOne: jest.Mock;
  };
  let stockModel: {
    findOneAndUpdate: jest.Mock;
  };
  let commissionService: {
    calculate: jest.Mock;
  };
  let currencyRateService: {
    getRate: jest.Mock;
  };
  let session: { withTransaction: jest.Mock; endSession: jest.Mock };
  let connection: { startSession: jest.Mock };

  beforeEach(() => {
    orderModel = {
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    userModel = {
      findById: jest.fn(),
    };
    positionModel = {
      findOne: jest.fn(),
    };
    stockModel = {
      findOneAndUpdate: jest.fn(),
    };
    commissionService = {
      calculate: jest.fn(),
    };
    currencyRateService = {
      getRate: jest.fn(),
    };
    session = {
      withTransaction: jest.fn((callback: () => Promise<unknown>) =>
        callback(),
      ),
      endSession: jest.fn(),
    };
    connection = {
      startSession: jest.fn().mockResolvedValue(session),
    };

    service = new OrdersService(
      connection as never,
      orderModel as never,
      userModel as never,
      positionModel as never,
      stockModel as never,
      commissionService as never,
      { executeMarketOrder: jest.fn() } as never,
      currencyRateService as never,
    );
  });

  it('crea una orden de compra valida y reserva saldo', async () => {
    const user = {
      availableBalance: 1000,
      reservedBalance: 0,
      save: jest.fn().mockResolvedValue(undefined),
    };

    userModel.findById.mockReturnValue(createExecQuery(user));
    stockModel.findOneAndUpdate.mockResolvedValue({ symbol: 'AAPL' });
    commissionService.calculate.mockResolvedValue(2.5);
    orderModel.create.mockResolvedValue([
      {
        id: 'order-1',
        status: 'PENDING',
      },
    ]);

    const result = await service.createOrder(new Types.ObjectId().toString(), {
      symbol: 'aapl',
      side: 'BUY',
      quantity: 2,
      limitPrice: 100,
    });

    expect(user.availableBalance).toBe(797.5);
    expect(user.reservedBalance).toBe(202.5);
    expect(user.save).toHaveBeenCalledWith({ session });
    expect(stockModel.findOneAndUpdate).toHaveBeenCalledWith(
      { symbol: 'AAPL' },
      { $currentDate: { updatedAt: true } },
      { returnDocument: 'after', session },
    );
    expect(orderModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          symbol: 'AAPL',
          side: 'BUY',
          quantity: 2,
          limitPrice: 100,
          status: 'PENDING',
          reservedAmount: 202.5,
        }),
      ],
      { session },
    );
    expect(result).toEqual({
      id: 'order-1',
      status: 'PENDING',
    });
  });

  it.each([2.9, 0, -1])(
    'rechaza la cantidad inválida %s sin abrir una transacción',
    async (quantity) => {
      await expect(
        service.createOrder(new Types.ObjectId().toString(), {
          symbol: 'AAPL',
          side: 'BUY',
          quantity,
          limitPrice: 100,
        }),
      ).rejects.toThrow('La cantidad debe ser un entero positivo.');

      expect(connection.startSession).not.toHaveBeenCalled();
      expect(orderModel.create).not.toHaveBeenCalled();
    },
  );

  it('redondea la reserva de compra incluyendo la comision estimada', async () => {
    const user = {
      availableBalance: 100,
      reservedBalance: 0,
      save: jest.fn().mockResolvedValue(undefined),
    };

    userModel.findById.mockReturnValue(createExecQuery(user));
    stockModel.findOneAndUpdate.mockResolvedValue({ symbol: 'ROUND.SN' });
    commissionService.calculate.mockResolvedValue(0.16);
    orderModel.create.mockResolvedValue([{ id: 'order-round' }]);

    await service.createOrder(new Types.ObjectId().toString(), {
      symbol: 'round.sn',
      side: 'BUY',
      quantity: 3,
      limitPrice: 10.335,
    });

    expect(user.availableBalance).toBe(68.83);
    expect(user.reservedBalance).toBe(31.17);
    expect(orderModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          symbol: 'ROUND.SN',
          quantity: 3,
          reservedAmount: 31.17,
        }),
      ],
      { session },
    );
  });

  it('crea una orden de venta valida y reserva acciones', async () => {
    const position = {
      quantity: 7,
      reservedQuantity: 1,
      save: jest.fn().mockResolvedValue(undefined),
    };

    userModel.findById.mockReturnValue(
      createExecQuery({
        id: new Types.ObjectId().toString(),
        availableBalance: 1000,
        reservedBalance: 0,
      }),
    );
    stockModel.findOneAndUpdate.mockResolvedValue({ symbol: 'SELL.SN' });
    positionModel.findOne.mockReturnValue(createExecQuery(position));
    orderModel.create.mockResolvedValue([{ id: 'order-sell' }]);

    await service.createOrder(new Types.ObjectId().toString(), {
      symbol: 'sell.sn',
      side: 'SELL',
      quantity: 3,
      limitPrice: 25,
    });

    expect(position.reservedQuantity).toBe(4);
    expect(position.save).toHaveBeenCalledWith({ session });
    expect(orderModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          symbol: 'SELL.SN',
          side: 'SELL',
          quantity: 3,
          reservedAmount: 0,
        }),
      ],
      { session },
    );
  });

  it('rechaza la orden cuando el saldo disponible no alcanza', async () => {
    userModel.findById.mockReturnValue(
      createExecQuery({
        availableBalance: 50,
        reservedBalance: 0,
        save: jest.fn(),
      }),
    );
    stockModel.findOneAndUpdate.mockResolvedValue({ symbol: 'AAPL' });
    commissionService.calculate.mockResolvedValue(1);

    const createOrderDto: CreateOrderDto = {
      symbol: 'AAPL',
      side: 'BUY',
      quantity: 1,
      limitPrice: 100,
    };

    await expect(
      service.createOrder(new Types.ObjectId().toString(), createOrderDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orderModel.create).not.toHaveBeenCalled();
    expect(commissionService.calculate).toHaveBeenCalledWith(100);
  });

  it('rechaza la venta cuando no hay posicion suficiente libre', async () => {
    userModel.findById.mockReturnValue(
      createExecQuery({
        id: new Types.ObjectId().toString(),
        availableBalance: 1000,
        reservedBalance: 0,
        save: jest.fn(),
      }),
    );
    stockModel.findOneAndUpdate.mockResolvedValue({ symbol: 'AAPL' });
    positionModel.findOne.mockReturnValue(
      createExecQuery({
        quantity: 3,
        reservedQuantity: 2,
        save: jest.fn(),
      }),
    );

    await expect(
      service.createOrder(new Types.ObjectId().toString(), {
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 2,
        limitPrice: 110,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orderModel.create).not.toHaveBeenCalled();
  });

  it('propaga el fallo de creación dentro de la transacción', async () => {
    const user = {
      availableBalance: 1000,
      reservedBalance: 0,
      save: jest.fn(),
    };
    userModel.findById.mockReturnValue(createExecQuery(user));
    stockModel.findOneAndUpdate.mockResolvedValue({ symbol: 'AAPL' });
    commissionService.calculate.mockResolvedValue(1);
    orderModel.create.mockRejectedValue(new Error('database failure'));

    await expect(
      service.createOrder(new Types.ObjectId().toString(), {
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 1,
        limitPrice: 100,
      }),
    ).rejects.toThrow('database failure');

    expect(session.withTransaction).toHaveBeenCalled();
    expect(user.save).toHaveBeenCalledWith({ session });
    expect(session.endSession).toHaveBeenCalled();
  });

  it('rechaza una reserva concurrente cuando el saldo solo cubre una orden', async () => {
    const user = {
      availableBalance: 150,
      reservedBalance: 0,
      save: jest.fn(),
    };
    userModel.findById.mockReturnValue(createExecQuery(user));
    stockModel.findOneAndUpdate.mockResolvedValue({ symbol: 'AAPL' });
    commissionService.calculate.mockResolvedValue(1);
    orderModel.create.mockResolvedValue([{ id: 'order-1' }]);
    connection.startSession.mockImplementation(() =>
      Promise.resolve({
        withTransaction: jest.fn((callback: () => Promise<unknown>) =>
          callback(),
        ),
        endSession: jest.fn(),
      }),
    );

    const dto: CreateOrderDto = {
      symbol: 'AAPL',
      side: 'BUY',
      quantity: 1,
      limitPrice: 100,
    };
    const userId = new Types.ObjectId().toString();
    const results = await Promise.allSettled([
      service.createOrder(userId, { ...dto }),
      service.createOrder(userId, { ...dto }),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(
      1,
    );
    expect(user).toMatchObject({
      availableBalance: 49,
      reservedBalance: 101,
    });
  });

  it('cancela una LIMIT BUY pendiente y libera el saldo reservado', async () => {
    const userId = new Types.ObjectId().toString();
    const orderId = new Types.ObjectId().toString();
    const order = {
      status: 'PENDING',
      side: 'BUY',
      reservedAmount: 202.5,
      save: jest.fn(),
    };
    const user = {
      availableBalance: 797.5,
      reservedBalance: 202.5,
      save: jest.fn(),
    };
    orderModel.findOneAndUpdate.mockResolvedValue(order);
    userModel.findById.mockReturnValue(createExecQuery(user));

    await expect(service.cancelOrder(userId, orderId)).resolves.toBe(order);

    expect(orderModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: new Types.ObjectId(orderId),
        userId: new Types.ObjectId(userId),
      },
      { $currentDate: { updatedAt: true } },
      { returnDocument: 'after', session },
    );
    expect(order.status).toBe('CANCELLED');
    expect(user).toMatchObject({
      availableBalance: 1000,
      reservedBalance: 0,
    });
    expect(user.save).toHaveBeenCalledWith({ session });
    expect(order.save).toHaveBeenCalledWith({ session });
  });

  it('cancela una LIMIT SELL pendiente y libera las acciones reservadas', async () => {
    const order = {
      status: 'PENDING',
      side: 'SELL',
      symbol: 'AAPL',
      quantity: 3,
      save: jest.fn(),
    };
    const position = {
      reservedQuantity: 5,
      save: jest.fn(),
    };
    orderModel.findOneAndUpdate.mockResolvedValue(order);
    positionModel.findOne.mockReturnValue(createExecQuery(position));

    await service.cancelOrder(
      new Types.ObjectId().toString(),
      new Types.ObjectId().toString(),
    );

    expect(order.status).toBe('CANCELLED');
    expect(position.reservedQuantity).toBe(2);
    expect(position.save).toHaveBeenCalledWith({ session });
  });

  it('mantiene idempotente la cancelacion de una orden ya cancelada', async () => {
    const order = {
      status: 'CANCELLED',
      side: 'BUY',
      save: jest.fn(),
    };
    orderModel.findOneAndUpdate.mockResolvedValue(order);

    await expect(
      service.cancelOrder(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ),
    ).resolves.toBe(order);

    expect(userModel.findById).not.toHaveBeenCalled();
    expect(positionModel.findOne).not.toHaveBeenCalled();
    expect(order.save).not.toHaveBeenCalled();
  });

  it('rechaza cancelar una orden ejecutada', async () => {
    orderModel.findOneAndUpdate.mockResolvedValue({
      status: 'EXECUTED',
      side: 'BUY',
    });

    await expect(
      service.cancelOrder(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lanza NotFoundException cuando la orden no existe', async () => {
    orderModel.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      service.cancelOrder(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(NotFoundException);

    expect(orderModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('lanza NotFoundException cuando el usuario no existe al cancelar una BUY', async () => {
    const order = {
      status: 'PENDING',
      side: 'BUY',
      reservedAmount: 100,
      save: jest.fn(),
    };
    orderModel.findOneAndUpdate.mockResolvedValue(order);
    userModel.findById.mockReturnValue(createExecQuery(null));

    await expect(
      service.cancelOrder(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('cancela una SELL sin position existente de forma graceful', async () => {
    const order = {
      status: 'PENDING',
      side: 'SELL',
      symbol: 'MISSING.SN',
      quantity: 3,
      save: jest.fn(),
    };
    orderModel.findOneAndUpdate.mockResolvedValue(order);
    positionModel.findOne.mockReturnValue(createExecQuery(null));

    await service.cancelOrder(
      new Types.ObjectId().toString(),
      new Types.ObjectId().toString(),
    );

    expect(order.status).toBe('CANCELLED');
    expect(order.save).toHaveBeenCalledWith({ session });
  });

  it('propaga errores inesperados de la transacción', async () => {
    const dbError = new Error('DB connection lost');
    session.withTransaction.mockRejectedValue(dbError);

    await expect(
      service.cancelOrder(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toThrow('DB connection lost');

    expect(session.endSession).toHaveBeenCalled();
  });
});

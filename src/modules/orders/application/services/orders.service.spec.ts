import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateOrderDto } from '../../presentation/dto/create-order.dto';
import { OrdersService } from './orders.service';

function createExecQuery<T>(value: T) {
  return {
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('OrdersService', () => {
  let service: OrdersService;
  let orderModel: {
    create: jest.Mock;
  };
  let userModel: {
    findById: jest.Mock;
  };
  let positionModel: {
    findOne: jest.Mock;
  };
  let stockModel: {
    findOne: jest.Mock;
  };
  let commissionService: {
    calculate: jest.Mock;
  };
  let currencyRateService: {
    getRate: jest.Mock;
  };

  beforeEach(() => {
    orderModel = {
      create: jest.fn(),
    };
    userModel = {
      findById: jest.fn(),
    };
    positionModel = {
      findOne: jest.fn(),
    };
    stockModel = {
      findOne: jest.fn(),
    };
    commissionService = {
      calculate: jest.fn(),
    };
    currencyRateService = {
      getRate: jest.fn(),
    };

    service = new OrdersService(
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
    stockModel.findOne.mockReturnValue(
      createExecQuery({
        symbol: 'AAPL',
      }),
    );
    commissionService.calculate.mockReturnValue(2.5);
    orderModel.create.mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
    });

    const result = await service.createOrder(new Types.ObjectId().toString(), {
      symbol: 'aapl',
      side: 'BUY',
      quantity: 2.8,
      limitPrice: 100,
    });

    expect(user.availableBalance).toBe(797.5);
    expect(user.reservedBalance).toBe(202.5);
    expect(user.save).toHaveBeenCalled();
    expect(orderModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'AAPL',
        side: 'BUY',
        quantity: 2,
        limitPrice: 100,
        status: 'PENDING',
        reservedAmount: 202.5,
      }),
    );
    expect(result).toEqual({
      id: 'order-1',
      status: 'PENDING',
    });
  });

  it('redondea la reserva de compra incluyendo la comision estimada', async () => {
    const user = {
      availableBalance: 100,
      reservedBalance: 0,
      save: jest.fn().mockResolvedValue(undefined),
    };

    userModel.findById.mockReturnValue(createExecQuery(user));
    stockModel.findOne.mockReturnValue(createExecQuery({ symbol: 'ROUND.SN' }));
    commissionService.calculate.mockReturnValue(0.16);
    orderModel.create.mockResolvedValue({ id: 'order-round' });

    await service.createOrder(new Types.ObjectId().toString(), {
      symbol: 'round.sn',
      side: 'BUY',
      quantity: 3,
      limitPrice: 10.335,
    });

    expect(user.availableBalance).toBe(68.83);
    expect(user.reservedBalance).toBe(31.17);
    expect(orderModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'ROUND.SN',
        quantity: 3,
        reservedAmount: 31.17,
      }),
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
    stockModel.findOne.mockReturnValue(createExecQuery({ symbol: 'SELL.SN' }));
    positionModel.findOne.mockReturnValue(createExecQuery(position));
    orderModel.create.mockResolvedValue({ id: 'order-sell' });

    await service.createOrder(new Types.ObjectId().toString(), {
      symbol: 'sell.sn',
      side: 'SELL',
      quantity: 3,
      limitPrice: 25,
    });

    expect(position.reservedQuantity).toBe(4);
    expect(position.save).toHaveBeenCalled();
    expect(orderModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'SELL.SN',
        side: 'SELL',
        quantity: 3,
        reservedAmount: 0,
      }),
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
    stockModel.findOne.mockReturnValue(
      createExecQuery({
        symbol: 'AAPL',
      }),
    );
    commissionService.calculate.mockReturnValue(1);

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
    stockModel.findOne.mockReturnValue(
      createExecQuery({
        symbol: 'AAPL',
      }),
    );
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
});

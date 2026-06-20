import { OrdersController } from './orders.controller';

describe('OrdersController', () => {
  it('delega la cancelacion usando el usuario autenticado', async () => {
    const ordersService = {
      cancelOrder: jest.fn().mockResolvedValue({ status: 'CANCELLED' }),
    };
    const controller = new OrdersController(ordersService as never);

    await controller.cancelOrder(
      {
        sub: 'user-1',
        email: 'user@quill.dev',
        role: 'investor',
        tokenVersion: 0,
      },
      'order-1',
    );

    expect(ordersService.cancelOrder).toHaveBeenCalledWith('user-1', 'order-1');
  });
});

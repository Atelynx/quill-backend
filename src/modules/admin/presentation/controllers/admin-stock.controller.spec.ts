import { AdminStockController } from './admin-stock.controller';

describe('AdminStockController', () => {
  it('delega busqueda y paginacion ya validadas', async () => {
    const listStocks = jest.fn().mockResolvedValue({ data: [], meta: {} });
    const controller = new AdminStockController({ listStocks } as never);

    await controller.findAll('AAPL', 'admin', 2, 100);

    expect(listStocks).toHaveBeenCalledWith({
      search: 'AAPL',
      source: 'admin',
      page: 2,
      limit: 100,
    });
  });
});

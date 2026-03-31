import { Types } from 'mongoose';
import { PortfolioService } from './portfolio.service';

function createLeanQuery<T>(value: T) {
  return {
    lean: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(value),
    }),
  };
}

describe('PortfolioService', () => {
  it('calcula las metricas principales del portafolio', async () => {
    const positionModel = {
      find: jest.fn().mockReturnValue(
        createLeanQuery([
          {
            symbol: 'AAPL',
            quantity: 10,
            reservedQuantity: 2,
            averageCost: 100,
          },
          {
            symbol: 'MSFT',
            quantity: 5,
            reservedQuantity: 0,
            averageCost: 50,
          },
          {
            symbol: 'TSLA',
            quantity: 0,
            reservedQuantity: 0,
            averageCost: 200,
          },
        ]),
      ),
    };
    const stockModel = {
      find: jest.fn().mockReturnValue(
        createLeanQuery([
          {
            symbol: 'AAPL',
            currentPrice: 110,
          },
          {
            symbol: 'MSFT',
            currentPrice: 40,
          },
        ]),
      ),
    };
    const usersService = {
      findById: jest.fn().mockResolvedValue({
        availableBalance: 500,
        reservedBalance: 100,
      }),
    };

    const service = new PortfolioService(
      positionModel as never,
      stockModel as never,
      usersService as never,
    );

    const summary = await service.getSummary(new Types.ObjectId().toString());

    expect(summary.availableBalance).toBe(500);
    expect(summary.reservedBalance).toBe(100);
    expect(summary.investedValue).toBe(1300);
    expect(summary.unrealizedProfitLoss).toBe(50);
    expect(summary.totalEquity).toBe(1800);
    expect(summary.positions).toEqual([
      {
        symbol: 'AAPL',
        quantity: 10,
        reservedQuantity: 2,
        averageCost: 100,
        marketPrice: 110,
        marketValue: 1100,
        unrealizedProfitLoss: 100,
      },
      {
        symbol: 'MSFT',
        quantity: 5,
        reservedQuantity: 0,
        averageCost: 50,
        marketPrice: 40,
        marketValue: 200,
        unrealizedProfitLoss: -50,
      },
    ]);
  });
});

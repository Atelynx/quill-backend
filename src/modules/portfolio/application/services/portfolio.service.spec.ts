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
            close: 110,
            currency: 'CLP',
          },
          {
            symbol: 'MSFT',
            close: 40,
            currency: 'CLP',
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
    const currencyRateService = {
      getRate: jest.fn(),
    };

    const service = new PortfolioService(
      positionModel as never,
      stockModel as never,
      usersService as never,
      currencyRateService as never,
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

  it('convierte valores USD a CLP para los totales del portafolio', async () => {
    const positionModel = {
      find: jest.fn().mockReturnValue(
        createLeanQuery([
          {
            symbol: 'AAPL',
            quantity: 10,
            reservedQuantity: 0,
            averageCost: 150,
          },
        ]),
      ),
    };
    const stockModel = {
      find: jest.fn().mockReturnValue(
        createLeanQuery([
          {
            symbol: 'AAPL',
            close: 200,
            currency: 'USD',
          },
        ]),
      ),
    };
    const usersService = {
      findById: jest.fn().mockResolvedValue({
        availableBalance: 500_000,
        reservedBalance: 0,
      }),
    };
    const currencyRateService = {
      getRate: jest.fn().mockResolvedValue({ rate: 900 }),
    };

    const service = new PortfolioService(
      positionModel as never,
      stockModel as never,
      usersService as never,
      currencyRateService as never,
    );

    const summary = await service.getSummary(new Types.ObjectId().toString());

    // Per-position values stay in native currency
    expect(summary.positions[0]).toMatchObject({
      symbol: 'AAPL',
      marketPrice: 200,
      marketValue: 2000,
      unrealizedProfitLoss: 500,
    });

    // Totals are converted to CLP: 2000 * 900 = 1,800,000
    expect(summary.investedValue).toBe(1_800_000);
    // P&L: 500 * 900 = 450,000
    expect(summary.unrealizedProfitLoss).toBe(450_000);
    // totalEquity: 500,000 + 1,800,000 = 2,300,000
    expect(summary.totalEquity).toBe(2_300_000);
    expect(currencyRateService.getRate).toHaveBeenCalledWith('USDCLP');
  });

  it('maneja posiciones mixtas CLP y USD en el portafolio', async () => {
    const positionModel = {
      find: jest.fn().mockReturnValue(
        createLeanQuery([
          {
            symbol: 'CHILE',
            quantity: 100,
            reservedQuantity: 0,
            averageCost: 1000,
          },
          {
            symbol: 'AAPL',
            quantity: 5,
            reservedQuantity: 0,
            averageCost: 150,
          },
        ]),
      ),
    };
    const stockModel = {
      find: jest.fn().mockReturnValue(
        createLeanQuery([
          {
            symbol: 'CHILE',
            close: 1100,
            currency: 'CLP',
          },
          {
            symbol: 'AAPL',
            close: 200,
            currency: 'USD',
          },
        ]),
      ),
    };
    const usersService = {
      findById: jest.fn().mockResolvedValue({
        availableBalance: 1_000_000,
        reservedBalance: 0,
      }),
    };
    const currencyRateService = {
      getRate: jest.fn().mockResolvedValue({ rate: 900 }),
    };

    const service = new PortfolioService(
      positionModel as never,
      stockModel as never,
      usersService as never,
      currencyRateService as never,
    );

    const summary = await service.getSummary(new Types.ObjectId().toString());

    // Per-position stays native
    expect(summary.positions[0]).toMatchObject({
      symbol: 'CHILE',
      marketValue: 110_000,
    });
    expect(summary.positions[1]).toMatchObject({
      symbol: 'AAPL',
      marketValue: 1000,
    });

    // Totals: 110_000 (CLP, no conversion) + 1000 * 900 (USD→CLP) = 110_000 + 900_000 = 1_010_000
    expect(summary.investedValue).toBe(1_010_000);
    expect(summary.totalEquity).toBe(2_010_000);
    expect(currencyRateService.getRate).toHaveBeenCalledWith('USDCLP');
  });

  it('tolera tasa de cambio no disponible sin romper el resumen', async () => {
    const positionModel = {
      find: jest.fn().mockReturnValue(
        createLeanQuery([
          {
            symbol: 'AAPL',
            quantity: 10,
            reservedQuantity: 0,
            averageCost: 150,
          },
          {
            symbol: 'MSFT',
            quantity: 5,
            reservedQuantity: 0,
            averageCost: 50,
          },
        ]),
      ),
    };
    const stockModel = {
      find: jest.fn().mockReturnValue(
        createLeanQuery([
          {
            symbol: 'AAPL',
            close: 200,
            currency: 'USD',
          },
          {
            symbol: 'MSFT',
            close: 100,
            currency: 'USD',
          },
        ]),
      ),
    };
    const usersService = {
      findById: jest.fn().mockResolvedValue({
        availableBalance: 500_000,
        reservedBalance: 0,
      }),
    };
    const currencyRateService = {
      getRate: jest.fn().mockResolvedValue(null),
    };

    const service = new PortfolioService(
      positionModel as never,
      stockModel as never,
      usersService as never,
      currencyRateService as never,
    );

    const summary = await service.getSummary(new Types.ObjectId().toString());

    // Si la tasa no existe, usa fallback nativo y no cachea la ausencia.
    expect(summary.investedValue).toBe(2500);
    expect(summary.positions[0].marketValue).toBe(2000);
    expect(currencyRateService.getRate).toHaveBeenCalledTimes(2);
    expect(currencyRateService.getRate).toHaveBeenCalledWith('USDCLP');
  });
});

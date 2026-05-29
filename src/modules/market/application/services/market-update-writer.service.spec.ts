import { ConfigService } from '@nestjs/config';
import { MarketUpdateWriterService } from './market-update-writer.service';

describe('MarketUpdateWriterService', () => {
  it('guarda snapshot cuando la actualizacion viene desde EODHD', async () => {
    const stockModel = { bulkWrite: jest.fn().mockResolvedValue({}) };
    const snapshotModel = { insertMany: jest.fn().mockResolvedValue([]) };
    const cacheService = { set: jest.fn() };
    const service = new MarketUpdateWriterService(
      stockModel as never,
      snapshotModel as never,
      cacheService as never,
      { get: jest.fn(() => 86400) } as unknown as ConfigService,
    );

    await service.persist(
      [
        {
          stock: {
            _id: '1',
            symbol: 'COPEC.SN',
            name: 'COPEC',
            previousClose: 100,
          } as never,
          quote: {
            symbol: 'COPEC.SN',
            name: 'COPEC',
            price: 120,
            close: 120,
            previousClose: 100,
            currency: 'CLP',
            timestamp: new Date('2026-01-01T12:00:00Z'),
            exchange: 'SN',
            source: 'eodhd',
          },
          save: true,
        },
      ],
      'eodhd',
    );

    expect(snapshotModel.insertMany).toHaveBeenCalledWith([
      { symbol: 'COPEC.SN', price: 120, source: 'eodhd' },
    ]);
    expect(stockModel.bulkWrite.mock.calls[0][0][0].updateOne.update.$set).toMatchObject({
      close: 120,
      dayChangePercentage: 20,
      source: 'eodhd',
    });
  });
});

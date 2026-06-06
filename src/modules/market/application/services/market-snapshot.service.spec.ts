import { MarketSnapshotService } from './market-snapshot.service';

describe('MarketSnapshotService', () => {
  let service: MarketSnapshotService;
  let snapshotModel: { find: jest.Mock };

  const mockStocks = [
    { symbol: 'AAPL', name: 'Apple', currency: 'USD', previousClose: 100 },
    { symbol: 'GOOGL', name: 'Alphabet', currency: 'USD', previousClose: 2800 },
  ];

  beforeEach(() => {
    snapshotModel = { find: jest.fn() };
    service = new MarketSnapshotService(snapshotModel as never);
  });

  describe('getLatestMap', () => {
    it('returns map of latest snapshot per symbol', async () => {
      const snapshots = [
        {
          symbol: 'AAPL',
          price: 150,
          source: 'eodhd',
          createdAt: new Date('2026-01-02'),
        },
        {
          symbol: 'AAPL',
          price: 149,
          source: 'eodhd',
          createdAt: new Date('2026-01-01'),
        },
        {
          symbol: 'GOOGL',
          price: 2800,
          source: 'eodhd',
          createdAt: new Date('2026-01-02'),
        },
      ];
      snapshotModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(snapshots),
          }),
        }),
      });

      const result = await service.getLatestMap(mockStocks as never);

      expect(result.size).toBe(2);
      expect(result.get('AAPL')!.price).toBe(150);
      expect(result.get('GOOGL')!.price).toBe(2800);
    });

    it('returns empty map when no snapshots found', async () => {
      snapshotModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await service.getLatestMap(mockStocks as never);

      expect(result.size).toBe(0);
    });

    it('filters by source when provided', async () => {
      snapshotModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.getLatestMap(mockStocks as never, { source: 'mock' });

      expect(snapshotModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'mock' }),
      );
    });

    it('filters by date when provided', async () => {
      const from = new Date('2026-01-01');
      snapshotModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await service.getLatestMap(mockStocks as never, { from });

      expect(snapshotModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: { $gte: from } }),
      );
    });
  });

  describe('quoteFromSnapshot', () => {
    it('builds a MarketQuote from stock and snapshot', () => {
      const stock = mockStocks[0] as never;
      const snapshot = {
        price: 150,
        source: 'eodhd',
        createdAt: new Date('2026-01-02T12:00:00Z'),
      } as never;

      const quote = service.quoteFromSnapshot(stock, snapshot);

      expect(quote).toMatchObject({
        symbol: 'AAPL',
        name: 'Apple',
        price: 150,
        close: 150,
        currency: 'USD',
        exchange: 'SNAPSHOT',
        source: 'eodhd',
        previousClose: 100,
      });
    });

    it('computes dayChangePercentage from previous close', () => {
      const stock = {
        symbol: 'X',
        name: 'X',
        currency: 'USD',
        previousClose: 200,
      } as never;
      const snapshot = {
        price: 210,
        source: 'test',
        createdAt: new Date(),
      } as never;

      const quote = service.quoteFromSnapshot(stock, snapshot);

      expect(quote.dayChangePercentage).toBe(5);
    });

    it('handles negative day change', () => {
      const stock = {
        symbol: 'X',
        name: 'X',
        currency: 'USD',
        previousClose: 100,
      } as never;
      const snapshot = {
        price: 80,
        source: 'test',
        createdAt: new Date(),
      } as never;

      const quote = service.quoteFromSnapshot(stock, snapshot);

      expect(quote.dayChangePercentage).toBe(-20);
    });

    it('uses snapshot as fallback source', () => {
      const stock = {
        symbol: 'X',
        name: 'X',
        currency: 'USD',
        previousClose: 100,
      } as never;
      const snapshot = {
        price: 100,
        createdAt: new Date(),
      } as never;

      const quote = service.quoteFromSnapshot(stock, snapshot);

      expect(quote.source).toBe('snapshot');
    });
  });
});

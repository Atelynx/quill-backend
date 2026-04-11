import { Types } from 'mongoose';
import { TradesService } from './trades.service';

describe('TradesService', () => {
  it('lista las operaciones del usuario ordenadas por fecha y con limite', async () => {
    const exec = jest.fn().mockResolvedValue([{ id: 'trade-1' }]);
    const lean = jest.fn().mockReturnValue({ exec });
    const limit = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ limit });
    const find = jest.fn().mockReturnValue({ sort });

    const service = new TradesService({
      find,
    } as never);

    const userId = new Types.ObjectId().toString();
    const result = await service.listUserTrades(userId, 10);

    expect(find).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
    });
    expect(sort).toHaveBeenCalledWith({ executedAt: -1 });
    expect(limit).toHaveBeenCalledWith(10);
    expect(result).toEqual([{ id: 'trade-1' }]);
  });

  it('usa 20 como limite por defecto', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const lean = jest.fn().mockReturnValue({ exec });
    const limit = jest.fn().mockReturnValue({ lean });
    const sort = jest.fn().mockReturnValue({ limit });

    const service = new TradesService({
      find: jest.fn().mockReturnValue({ sort }),
    } as never);

    await service.listUserTrades(new Types.ObjectId().toString());

    expect(limit).toHaveBeenCalledWith(20);
  });
});

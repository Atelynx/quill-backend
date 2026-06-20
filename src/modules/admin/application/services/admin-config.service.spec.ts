import { BadRequestException } from '@nestjs/common';
import { AdminConfigService } from './admin-config.service';

const execQuery = <T>(value: T) => ({
  exec: jest.fn().mockResolvedValue(value),
});

const sessionQuery = <T>(value: T) => ({
  session: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(value),
});

describe('AdminConfigService', () => {
  let service: AdminConfigService;
  let adminConfigModel: {
    updateMany: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
  };
  let snapshotModel: { create: jest.Mock; findById: jest.Mock };
  let session: { withTransaction: jest.Mock; endSession: jest.Mock };
  let connection: { startSession: jest.Mock };

  beforeEach(() => {
    adminConfigModel = {
      updateMany: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
    };
    snapshotModel = { create: jest.fn(), findById: jest.fn() };
    session = {
      withTransaction: jest.fn((callback: () => Promise<void>) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    connection = { startSession: jest.fn().mockResolvedValue(session) };
    service = new AdminConfigService(
      adminConfigModel as never,
      snapshotModel as never,
      connection as never,
      { get: jest.fn() } as never,
    );
  });

  it('actualiza la configuración y crea snapshot en una transacción', async () => {
    const created = { key: 'COMMISSION_RATE', value: 0.01 };
    adminConfigModel.updateMany.mockReturnValue(sessionQuery(undefined));
    adminConfigModel.create.mockResolvedValue([created]);
    adminConfigModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue(sessionQuery([created])),
    });
    snapshotModel.create.mockResolvedValue([{ configs: created }]);

    await expect(service.set('COMMISSION_RATE', 0.01)).resolves.toBe(created);

    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(adminConfigModel.create).toHaveBeenCalledWith(
      [expect.objectContaining({ key: 'COMMISSION_RATE', inUse: true })],
      { session },
    );
    expect(snapshotModel.create).toHaveBeenCalledWith(expect.any(Array), {
      session,
    });
    expect(session.endSession).toHaveBeenCalled();
  });

  it('propaga un fallo intermedio para que la transacción revierta set', async () => {
    adminConfigModel.updateMany.mockReturnValue(sessionQuery(undefined));
    adminConfigModel.create.mockResolvedValue([
      { key: 'COMMISSION_RATE', value: 0.01 },
    ]);
    adminConfigModel.find.mockReturnValue({
      lean: jest.fn().mockReturnValue(sessionQuery([])),
    });
    snapshotModel.create.mockRejectedValue(new Error('Fallo de snapshot'));

    await expect(service.set('COMMISSION_RATE', 0.01)).rejects.toThrow(
      'Fallo de snapshot',
    );

    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalled();
  });

  it('valida el snapshot completo antes de iniciar la restauración', async () => {
    snapshotModel.findById.mockReturnValue(
      execQuery({
        configs: { COMMISSION_RATE: 0.01, MARKET_HOURS_OPEN: '99:00' },
      }),
    );

    await expect(service.restoreSnapshot('snapshot-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(connection.startSession).not.toHaveBeenCalled();
    expect(adminConfigModel.updateMany).not.toHaveBeenCalled();
  });

  it('restaura el conjunto completo y crea auditoría atómicamente', async () => {
    const snapshot = {
      configs: { COMMISSION_RATE: 0.02, MARKET_HOURS_OPEN: '09:30' },
      name: 'Configuración estable',
    };
    const audit = { configs: snapshot.configs, name: 'Restore' };
    snapshotModel.findById.mockReturnValue(execQuery(snapshot));
    adminConfigModel.updateMany.mockReturnValue(sessionQuery(undefined));
    adminConfigModel.create.mockResolvedValue([]);
    snapshotModel.create.mockResolvedValue([audit]);

    await expect(service.restoreSnapshot('snapshot-1')).resolves.toBe(audit);

    expect(adminConfigModel.updateMany).toHaveBeenCalledWith(
      { inUse: true },
      { $set: { inUse: false } },
    );
    expect(adminConfigModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({ key: 'COMMISSION_RATE', value: 0.02 }),
        expect.objectContaining({ key: 'MARKET_HOURS_OPEN', value: '09:30' }),
      ],
      { session },
    );
    expect(snapshotModel.create).toHaveBeenCalledWith(expect.any(Array), {
      session,
    });
    expect(session.endSession).toHaveBeenCalled();
  });
});

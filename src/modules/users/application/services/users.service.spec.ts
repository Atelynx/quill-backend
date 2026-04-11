import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

function createExecQuery<T>(value: T) {
  return {
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let userModel: {
    exists: jest.Mock;
    create: jest.Mock;
    findOne: jest.Mock;
    findById: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    userModel = {
      exists: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };

    service = new UsersService(userModel as never, configService as never);
  });

  it('crea un usuario con saldo inicial y correo normalizado', async () => {
    userModel.exists.mockResolvedValue(null);
    configService.get.mockReturnValue(150000);
    userModel.create.mockResolvedValue({
      id: 'user-1',
      email: 'ana@quill.dev',
    });

    const result = await service.createUser({
      fullName: 'Ana Lopez',
      email: 'ANA@QUILL.DEV',
      passwordHash: 'hashed-password',
    });

    expect(userModel.exists).toHaveBeenCalledWith({
      email: 'ANA@QUILL.DEV',
    });
    expect(configService.get).toHaveBeenCalledWith('INITIAL_BALANCE', 100000);
    expect(userModel.create).toHaveBeenCalledWith({
      fullName: 'Ana Lopez',
      email: 'ana@quill.dev',
      passwordHash: 'hashed-password',
      availableBalance: 150000,
      reservedBalance: 0,
    });
    expect(result).toEqual({
      id: 'user-1',
      email: 'ana@quill.dev',
    });
  });

  it('rechaza crear un usuario cuando el correo ya existe', async () => {
    userModel.exists.mockResolvedValue({ _id: 'existing-user' });

    await expect(
      service.createUser({
        fullName: 'Ana Lopez',
        email: 'ana@quill.dev',
        passwordHash: 'hashed-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('busca usuarios por correo normalizado', async () => {
    const user = { id: 'user-1', email: 'ana@quill.dev' };
    userModel.findOne.mockReturnValue(createExecQuery(user));

    const result = await service.findByEmail('ANA@QUILL.DEV');

    expect(userModel.findOne).toHaveBeenCalledWith({
      email: 'ana@quill.dev',
    });
    expect(result).toBe(user);
  });

  it('lanza error si el usuario no existe al buscar por id', async () => {
    userModel.findById.mockReturnValue(createExecQuery(null));

    await expect(service.findById('user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('expone un perfil publico del usuario', () => {
    const profile = service.toProfile({
      id: 'user-1',
      fullName: 'Ana Lopez',
      email: 'ana@quill.dev',
      availableBalance: 100000,
      reservedBalance: 2500,
    } as never);

    expect(profile).toEqual({
      id: 'user-1',
      fullName: 'Ana Lopez',
      email: 'ana@quill.dev',
      availableBalance: 100000,
      reservedBalance: 2500,
    });
  });
});

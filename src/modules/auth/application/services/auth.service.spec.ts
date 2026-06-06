import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { UsersService } from '../../../users/application/services/users.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    createUser: jest.Mock;
    findByEmail: jest.Mock;
    toProfile: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
  };

  beforeEach(() => {
    usersService = {
      createUser: jest.fn(),
      findByEmail: jest.fn(),
      toProfile: jest.fn(),
    };
    jwtService = {
      sign: jest.fn(),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registra un usuario y devuelve el mensaje esperado', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    usersService.createUser.mockResolvedValue({
      email: 'ana@quill.dev',
      username: 'ana_lopez',
    });

    const result = await service.register({
      fullName: 'Ana Lopez',
      email: 'ana@quill.dev',
      password: 'Password123',
    });

    expect(usersService.createUser).toHaveBeenCalledWith({
      fullName: 'Ana Lopez',
      email: 'ana@quill.dev',
      passwordHash: 'hashed-password',
      username: undefined,
    });
    expect(result).toEqual({
      message: 'Cuenta creada correctamente. Inicia sesion para continuar.',
      email: 'ana@quill.dev',
      username: 'ana_lopez',
    });
  });

  it('registra un usuario con username personalizado', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    usersService.createUser.mockResolvedValue({
      email: 'ana@quill.dev',
      username: 'analopez',
    });

    const result = await service.register({
      fullName: 'Ana Lopez',
      email: 'ana@quill.dev',
      password: 'Password123',
      username: 'analopez',
    });

    expect(usersService.createUser).toHaveBeenCalledWith({
      fullName: 'Ana Lopez',
      email: 'ana@quill.dev',
      passwordHash: 'hashed-password',
      username: 'analopez',
    });
    expect(result.username).toBe('analopez');
  });

  it('inicia sesion y construye la respuesta autenticada', async () => {
    const user = {
      id: 'user-1',
      email: 'ana@quill.dev',
      passwordHash: 'stored-hash',
    };

    usersService.findByEmail.mockResolvedValue(user);
    usersService.toProfile.mockReturnValue({
      id: 'user-1',
      fullName: 'Ana Lopez',
      email: 'ana@quill.dev',
      availableBalance: 100000,
      reservedBalance: 0,
    });
    jwtService.sign.mockReturnValue('signed-token');

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'ana@quill.dev',
      password: 'Password123',
    });

    expect(usersService.findByEmail).toHaveBeenCalledWith('ana@quill.dev');
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'ana@quill.dev',
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      user: {
        id: 'user-1',
        fullName: 'Ana Lopez',
        email: 'ana@quill.dev',
        availableBalance: 100000,
        reservedBalance: 0,
      },
    });
  });

  it('rechaza credenciales invalidas cuando el usuario no existe', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'missing@quill.dev',
        password: 'Password123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza credenciales invalidas cuando la contrasena no coincide', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: new Types.ObjectId().toString(),
      email: 'ana@quill.dev',
      passwordHash: 'stored-hash',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'ana@quill.dev',
        password: 'WrongPassword123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

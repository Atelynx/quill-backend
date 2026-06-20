import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('jwt-strategy', () => {
  let strategy: JwtStrategy;
  let configService: Partial<ConfigService>;
  const mockedPayload = {
    email: 'example@gmail.com',
    sub: 'example',
    role: 'investor' as const,
    tokenVersion: 2,
  };
  const usersService = {
    findById: jest.fn(),
  };
  beforeEach(() => {
    configService = {
      getOrThrow: jest.fn(() => 'JWT_KEY_EXAMPLE'),
    };
    usersService.findById.mockResolvedValue({
      id: 'example',
      email: 'current@gmail.com',
      role: 'admin',
      tokenVersion: 2,
    });
    strategy = new JwtStrategy(
      configService as ConfigService,
      usersService as never,
    );
  });

  it('valida el token contra el estado actual del usuario', async () => {
    await expect(strategy.validate(mockedPayload)).resolves.toEqual({
      sub: 'example',
      email: 'current@gmail.com',
      role: 'admin',
      tokenVersion: 2,
    });
  });

  it.each(['contraseña', 'rol'])(
    'revoca tokens anteriores tras un cambio de %s',
    async () => {
      usersService.findById.mockResolvedValue({
        id: 'example',
        tokenVersion: 3,
      });

      await expect(strategy.validate(mockedPayload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );

  it('revoca tokens sin version', async () => {
    await expect(
      strategy.validate({ ...mockedPayload, tokenVersion: undefined as never }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

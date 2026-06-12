import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

function createExecQuery<T>(value: T) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

function createLeanQuery<T>(value: T) {
  return { lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(value) }) };
}

describe('UsersService', () => {
  let service: UsersService;
  let userModel: any;
  let friendshipModel: any;
  let stockModel: any;
  let configService: any;

  beforeEach(() => {
    userModel = {
      exists: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };
    friendshipModel = {
      exists: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      deleteMany: jest.fn(),
      countDocuments: jest.fn(),
    };
    stockModel = {
      find: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };

    service = new UsersService(
      userModel as never,
      friendshipModel as never,
      stockModel as never,
      configService as never,
      { get: jest.fn().mockResolvedValue(null) } as never,
    );
  });

  describe('createUser', () => {
    it('crea un usuario con username auto-generado y correo normalizado', async () => {
      userModel.exists.mockResolvedValueOnce(null);
      userModel.exists.mockResolvedValueOnce(null);
      configService.get.mockReturnValue(100000);
      userModel.create.mockResolvedValue({
        id: 'user-1',
        email: 'ana@quill.dev',
        username: 'user_a1b2c3',
      });

      const result = await service.createUser({
        fullName: 'Ana Lopez',
        email: 'ANA@QUILL.DEV',
        passwordHash: 'hashed-password',
      });

      expect(userModel.exists).toHaveBeenNthCalledWith(1, {
        email: 'ANA@QUILL.DEV',
      });
      expect(userModel.create).toHaveBeenCalledWith({
        fullName: 'Ana Lopez',
        email: 'ana@quill.dev',
        passwordHash: 'hashed-password',
        username: expect.stringMatching(/^user_[0-9a-f]{6}$/),
        availableBalance: 100000,
        reservedBalance: 0,
      });
      expect(result).toEqual({
        id: 'user-1',
        email: 'ana@quill.dev',
        username: 'user_a1b2c3',
      });
    });

    it('usa el username proporcionado si es valido', async () => {
      userModel.exists.mockResolvedValueOnce(null);
      userModel.exists.mockResolvedValueOnce(null);
      configService.get.mockReturnValue(100000);
      userModel.create.mockResolvedValue({
        id: 'user-2',
        email: 'luis@quill.dev',
        username: 'luis123',
      });

      const result = await service.createUser({
        fullName: 'Luis Perez',
        email: 'luis@quill.dev',
        passwordHash: 'hashed-password',
        username: 'Luis123',
      });

      expect(userModel.exists).toHaveBeenNthCalledWith(2, {
        username: 'luis123',
      });
      expect(userModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'luis123' }),
      );
      expect(result.username).toBe('luis123');
    });

    it('rechaza username duplicado', async () => {
      userModel.exists.mockResolvedValueOnce(null);
      userModel.exists.mockResolvedValueOnce({ _id: 'existing' });

      await expect(
        service.createUser({
          fullName: 'Luis Perez',
          email: 'luis@quill.dev',
          passwordHash: 'hashed-password',
          username: 'TakenUser',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
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
  });

  describe('findByEmail', () => {
    it('busca por correo normalizado', async () => {
      const user = { id: 'user-1', email: 'ana@quill.dev' };
      userModel.findOne.mockReturnValue(createExecQuery(user));

      const result = await service.findByEmail('ANA@QUILL.DEV');

      expect(userModel.findOne).toHaveBeenCalledWith({
        email: 'ana@quill.dev',
      });
      expect(result).toBe(user);
    });
  });

  describe('findById', () => {
    it('lanza error si no existe', async () => {
      userModel.findById.mockReturnValue(createExecQuery(null));

      await expect(service.findById('user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('retorna el usuario si existe', async () => {
      const user = { id: 'user-1', email: 'ana@quill.dev' };
      userModel.findById.mockReturnValue(createExecQuery(user));

      expect(await service.findById('user-1')).toBe(user);
    });
  });

  describe('findByIdentity', () => {
    it('busca por email', async () => {
      const user = { id: 'user-1', email: 'ana@quill.dev' };
      userModel.findOne.mockReturnValue(createExecQuery(user));

      const result = await service.findByIdentity('ana@quill.dev');

      expect(userModel.findOne).toHaveBeenCalledWith({
        $or: [{ email: 'ana@quill.dev' }, { username: 'ana@quill.dev' }],
      });
      expect(result).toBe(user);
    });
  });

  describe('updateProfile', () => {
    it('actualiza fullName y username', async () => {
      const user = {
        _id: 'user-1',
        id: 'user-1',
        fullName: 'Old Name',
        username: 'old_user',
        save: jest.fn().mockResolvedValue(true),
      } as any;
      userModel.findById.mockReturnValue(createExecQuery(user));
      userModel.exists.mockResolvedValue(null);

      const result = await service.updateProfile('user-1', {
        fullName: 'New Name',
        username: 'new_user',
      });

      expect(user.fullName).toBe('New Name');
      expect(user.username).toBe('new_user');
      expect(user.save).toHaveBeenCalled();
      expect(result).toBe(user);
    });

    it('rechaza username duplicado', async () => {
      const user = {
        _id: 'user-1',
        save: jest.fn(),
      } as any;
      userModel.findById.mockReturnValue(createExecQuery(user));
      userModel.exists.mockResolvedValue({ _id: 'other-user' });

      await expect(
        service.updateProfile('user-1', { username: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('changeEmail', () => {
    it('cambia el email si la contraseña es correcta', async () => {
      const user = {
        _id: 'user-1',
        email: 'old@quill.dev',
        passwordHash: 'hashed',
        save: jest.fn().mockResolvedValue(true),
      } as any;
      userModel.findById.mockReturnValue(createExecQuery(user));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      userModel.exists.mockResolvedValue(null);

      await service.changeEmail('user-1', 'correct-password', 'new@quill.dev');

      expect(user.email).toBe('new@quill.dev');
      expect(user.save).toHaveBeenCalled();
    });

    it('rechaza con contraseña incorrecta', async () => {
      const user = {
        _id: 'user-1',
        passwordHash: 'hashed',
        save: jest.fn(),
      } as any;
      userModel.findById.mockReturnValue(createExecQuery(user));
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changeEmail('user-1', 'wrong', 'new@quill.dev'),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(user.save).not.toHaveBeenCalled();
    });

    it('rechaza si el nuevo email ya esta en uso', async () => {
      const user = {
        _id: 'user-1',
        passwordHash: 'hashed',
        save: jest.fn(),
      } as any;
      userModel.findById.mockReturnValue(createExecQuery(user));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      userModel.exists.mockResolvedValue({ _id: 'other-user' });

      await expect(
        service.changeEmail('user-1', 'pass', 'taken@quill.dev'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('changePassword', () => {
    it('cambia la contraseña si la actual es correcta', async () => {
      const user = {
        _id: 'user-1',
        passwordHash: 'old-hash',
        save: jest.fn().mockResolvedValue(true),
      } as any;
      userModel.findById.mockReturnValue(createExecQuery(user));
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');

      await service.changePassword('user-1', 'old-pass', 'new-pass-long');

      expect(bcrypt.hash).toHaveBeenCalledWith('new-pass-long', 10);
      expect(user.passwordHash).toBe('new-hash');
      expect(user.save).toHaveBeenCalled();
    });

    it('rechaza con contraseña actual incorrecta', async () => {
      const user = {
        _id: 'user-1',
        passwordHash: 'old-hash',
        save: jest.fn(),
      } as any;
      userModel.findById.mockReturnValue(createExecQuery(user));
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'wrong', 'new-pass-long'),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(user.save).not.toHaveBeenCalled();
    });
  });

  describe('watchlist', () => {
    it('agrega simbolos al watchlist', async () => {
      const user = {
        _id: 'user-1',
        watchlist: ['AAPL'],
        save: jest.fn().mockResolvedValue(true),
      } as any;
      userModel.findById.mockReturnValue(createExecQuery(user));

      const result = await service.addToWatchlist('user-1', ['AAPL', 'MSFT']);

      expect(user.watchlist).toEqual(['AAPL', 'MSFT']);
      expect(user.save).toHaveBeenCalled();
      expect(result).toBe(user);
    });

    it('elimina un simbolo del watchlist', async () => {
      const user = {
        _id: 'user-1',
        watchlist: ['AAPL', 'MSFT', 'GOOGL'],
        save: jest.fn().mockResolvedValue(true),
      } as any;
      userModel.findById.mockReturnValue(createExecQuery(user));

      const result = await service.removeFromWatchlist('user-1', 'MSFT');

      expect(user.watchlist).toEqual(['AAPL', 'GOOGL']);
      expect(result).toBe(user);
    });

    it('retorna datos de acciones para el watchlist', async () => {
      userModel.findById.mockReturnValue(
        createExecQuery({ _id: 'user-1', watchlist: ['AAPL', 'MSFT'] }),
      );
      stockModel.find.mockReturnValue(
        createLeanQuery([
          { symbol: 'AAPL', name: 'Apple', close: 150, previousClose: 148, dayChangePercentage: 1.35, currency: 'USD' },
          { symbol: 'MSFT', name: 'Microsoft', close: 300, previousClose: 295, dayChangePercentage: 1.69, currency: 'USD' },
        ]),
      );

      const result = await service.getWatchlist('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('AAPL');
      expect(result[1].symbol).toBe('MSFT');
    });
  });

  describe('friends', () => {
    const userId = new Types.ObjectId().toString();
    const friendId = new Types.ObjectId().toString();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('envia solicitud de amistad', async () => {
      userModel.findById.mockReturnValue(createExecQuery({ _id: friendId }));
      friendshipModel.exists.mockResolvedValue(null);
      friendshipModel.create.mockResolvedValue(true);

      await service.sendFriendRequest(userId, friendId);

      expect(friendshipModel.create).toHaveBeenCalledWith({
        userId: expect.any(Types.ObjectId),
        friendId: expect.any(Types.ObjectId),
        status: 'pending',
      });
    });

    it('rechaza auto-solicitud', async () => {
      await expect(
        service.sendFriendRequest(userId, userId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza solicitud duplicada', async () => {
      userModel.findById.mockReturnValue(createExecQuery({ _id: friendId }));
      friendshipModel.exists.mockResolvedValue({ _id: 'existing' });

      await expect(
        service.sendFriendRequest(userId, friendId),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('acepta solicitud de amistad', async () => {
      const request = {
        status: 'pending',
        save: jest.fn().mockResolvedValue(true),
      } as any;
      friendshipModel.findOne.mockReturnValue(createExecQuery(request));

      await service.acceptFriendRequest(userId, friendId);

      expect(request.status).toBe('accepted');
      expect(request.save).toHaveBeenCalled();
    });

    it('elimina amistad en ambas direcciones', async () => {
      friendshipModel.deleteMany.mockReturnValue(createExecQuery({ deletedCount: 2 }));

      await service.removeFriend(userId, friendId);

      expect(friendshipModel.deleteMany).toHaveBeenCalledWith({
        $or: [
          { userId: expect.any(Types.ObjectId), friendId: expect.any(Types.ObjectId) },
          { userId: expect.any(Types.ObjectId), friendId: expect.any(Types.ObjectId) },
        ],
      });
    });

    it('lista amigos aceptados', async () => {
      friendshipModel.find.mockReturnValue(
        createLeanQuery([
          { userId: new Types.ObjectId(userId), friendId: new Types.ObjectId(friendId), status: 'accepted' },
        ]),
      );
      userModel.find.mockReturnValue(
        createLeanQuery([
          { _id: new Types.ObjectId(friendId), fullName: 'Friend', email: 'friend@quill.dev', username: 'friend_user' },
        ]),
      );

      const friends = await service.getFriends(userId);

      expect(friends).toHaveLength(1);
      expect(friends[0].fullName).toBe('Friend');
    });
  });

  describe('toProfile', () => {
    it('expone el perfil publico del usuario incluyendo nuevos campos', () => {
      const profile = service.toProfile({
        id: 'user-1',
        fullName: 'Ana Lopez',
        email: 'ana@quill.dev',
        username: 'ana_lopez',
        availableBalance: 100000,
        reservedBalance: 2500,
        watchlist: ['AAPL', 'MSFT'],
      } as never);

      expect(profile).toEqual({
        id: 'user-1',
        fullName: 'Ana Lopez',
        email: 'ana@quill.dev',
        username: 'ana_lopez',
        availableBalance: 100000,
        reservedBalance: 2500,
        watchlist: ['AAPL', 'MSFT'],
      });
    });

    it('retorna username null si no tiene', () => {
      const profile = service.toProfile({
        id: 'user-1',
        fullName: 'Ana Lopez',
        email: 'ana@quill.dev',
        username: undefined,
        availableBalance: 100000,
        reservedBalance: 0,
        watchlist: [],
      } as never);

      expect(profile.username).toBeNull();
    });
  });
});

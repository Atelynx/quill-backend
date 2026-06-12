import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { AdminConfigService } from '../../../admin/application/services/admin-config.service';
import { Stock } from '../../../market/infrastructure/schemas/stock.schema';
import {
  Friendship,
  FriendshipDocument,
} from '../../infrastructure/schemas/friendship.schema';
import { User, UserDocument } from '../../infrastructure/schemas/user.schema';

function generateUsername(): string {
  const hex = Math.random().toString(16).slice(2, 8);
  return `user_${hex}`;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Friendship.name)
    private readonly friendshipModel: Model<FriendshipDocument>,
    @InjectModel(Stock.name)
    private readonly stockModel: Model<Stock>,
    private readonly configService: ConfigService,
    private readonly adminConfigService: AdminConfigService,
  ) {}

  async createUser(input: {
    fullName: string;
    email: string;
    passwordHash: string;
    username?: string;
  }): Promise<UserDocument> {
    const existingUser = await this.userModel.exists({ email: input.email });

    if (existingUser) {
      throw new ConflictException('Ya existe una cuenta con ese correo.');
    }

    let username = input.username;
    if (!username) {
      username = await this.generateUniqueUsername();
    } else {
      const usernameTaken = await this.userModel.exists({
        username: username.toLowerCase(),
      });
      if (usernameTaken) {
        throw new ConflictException('Ese nombre de usuario ya está en uso.');
      }
    }

    const adminBalance = await this.adminConfigService.get('INITIAL_BALANCE');
    const initialBalance = adminBalance ?? this.configService.get<number>(
      'INITIAL_BALANCE',
      100000,
    );

    return this.userModel.create({
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      username: username.toLowerCase(),
      availableBalance: initialBalance,
      reservedBalance: 0,
    });
  }

  private async generateUniqueUsername(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const candidate = generateUsername();
      const exists = await this.userModel.exists({ username: candidate });
      if (!exists) return candidate;
    }
    throw new Error('Could not generate a unique username');
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    return user;
  }

  async findByIdentity(identifier: string): Promise<UserDocument | null> {
    const lower = identifier.toLowerCase();
    return this.userModel
      .findOne({
        $or: [
          { email: lower },
          { username: lower },
        ],
      })
      .exec();
  }

  async updateProfile(
    id: string,
    updates: { fullName?: string; username?: string },
  ): Promise<UserDocument> {
    const user = await this.findById(id);

    if (updates.fullName !== undefined) {
      user.fullName = updates.fullName;
    }

    if (updates.username !== undefined) {
      const normalized = updates.username.toLowerCase();
      const taken = await this.userModel.exists({
        username: normalized,
        _id: { $ne: user._id },
      });
      if (taken) {
        throw new ConflictException('Ese nombre de usuario ya está en uso.');
      }
      user.username = normalized;
    }

    await user.save();
    return user;
  }

  async changeEmail(
    id: string,
    currentPassword: string,
    newEmail: string,
  ): Promise<void> {
    const user = await this.findById(id);

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta.');
    }

    const emailTaken = await this.userModel.exists({
      email: newEmail.toLowerCase(),
      _id: { $ne: user._id },
    });
    if (emailTaken) {
      throw new ConflictException('Ese correo ya está en uso.');
    }

    user.email = newEmail.toLowerCase();
    await user.save();
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findById(id);

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta.');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
  }

  async addToWatchlist(
    id: string,
    symbols: string[],
  ): Promise<UserDocument> {
    const user = await this.findById(id);
    const normalized = symbols.map((s) => s.toUpperCase());

    const existing = new Set(user.watchlist.map((s) => s.toUpperCase()));
    const newSymbols = normalized.filter((s) => !existing.has(s));

    if (newSymbols.length === 0) return user;

    user.watchlist.push(...newSymbols);
    await user.save();
    return user;
  }

  async removeFromWatchlist(id: string, symbol: string): Promise<UserDocument> {
    const user = await this.findById(id);
    user.watchlist = user.watchlist.filter(
      (s) => s.toUpperCase() !== symbol.toUpperCase(),
    );
    await user.save();
    return user;
  }

  async getWatchlist(id: string) {
    const user = await this.findById(id);
    if (user.watchlist.length === 0) return [];

    const stocks = await this.stockModel
      .find({ symbol: { $in: user.watchlist } })
      .lean()
      .exec();

    return stocks.map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      close: stock.close,
      previousClose: stock.previousClose,
      dayChangePercentage: stock.dayChangePercentage,
      currency: stock.currency,
    }));
  }

  async sendFriendRequest(
    userId: string,
    friendId: string,
  ): Promise<void> {
    if (userId === friendId) {
      throw new BadRequestException('No puedes agregarte a ti mismo.');
    }

    const friend = await this.userModel.findById(friendId).exec();
    if (!friend) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const existing = await this.friendshipModel.exists({
      userId: new Types.ObjectId(userId),
      friendId: new Types.ObjectId(friendId),
    });

    if (existing) {
      throw new ConflictException('Ya existe una solicitud o amistad.');
    }

    await this.friendshipModel.create({
      userId: new Types.ObjectId(userId),
      friendId: new Types.ObjectId(friendId),
      status: 'pending',
    });
  }

  async acceptFriendRequest(
    userId: string,
    friendId: string,
  ): Promise<void> {
    const request = await this.friendshipModel
      .findOne({
        userId: new Types.ObjectId(friendId),
        friendId: new Types.ObjectId(userId),
        status: 'pending',
      })
      .exec();

    if (!request) {
      throw new NotFoundException('Solicitud de amistad no encontrada.');
    }

    request.status = 'accepted';
    await request.save();
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    await this.friendshipModel
      .deleteMany({
        $or: [
          {
            userId: new Types.ObjectId(userId),
            friendId: new Types.ObjectId(friendId),
          },
          {
            userId: new Types.ObjectId(friendId),
            friendId: new Types.ObjectId(userId),
          },
        ],
      })
      .exec();
  }

  async getFriends(userId: string) {
    const friendships = await this.friendshipModel
      .find({
        $or: [
          { userId: new Types.ObjectId(userId) },
          { friendId: new Types.ObjectId(userId) },
        ],
        status: 'accepted',
      })
      .lean()
      .exec();

    if (friendships.length === 0) return [];

    const friendIds = friendships.map((f) => {
      const fId = f.userId.toString();
      return fId === userId ? f.friendId.toString() : fId;
    });

    const friends = await this.userModel
      .find({ _id: { $in: friendIds.map((id) => new Types.ObjectId(id)) } })
      .lean()
      .exec();

    return friends.map((f) => ({
      id: f._id.toString(),
      fullName: f.fullName,
      email: f.email,
      username: f.username ?? null,
    }));
  }

  async getPendingRequests(userId: string) {
    const requests = await this.friendshipModel
      .find({
        friendId: new Types.ObjectId(userId),
        status: 'pending',
      })
      .lean()
      .exec();

    if (requests.length === 0) return [];

    const userIds = requests.map((r) => r.userId.toString());
    const users = await this.userModel
      .find({ _id: { $in: userIds.map((id) => new Types.ObjectId(id)) } })
      .lean()
      .exec();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    return requests.map((r) => {
      const u = userMap.get(r.userId.toString());
      return {
        id: r._id.toString(),
        fromUserId: r.userId.toString(),
        fullName: u?.fullName ?? null,
        email: u?.email ?? null,
        username: u?.username ?? null,
        requestedAt: (r as any).createdAt,
      };
    });
  }

  async getFriendsCount(userId: string): Promise<number> {
    return this.friendshipModel
      .countDocuments({
        $or: [
          { userId: new Types.ObjectId(userId) },
          { friendId: new Types.ObjectId(userId) },
        ],
        status: 'accepted',
      })
      .exec();
  }

  toProfile(user: UserDocument) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      username: user.username ?? null,
      availableBalance: user.availableBalance,
      reservedBalance: user.reservedBalance,
      watchlist: user.watchlist,
    };
  }
}

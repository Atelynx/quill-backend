import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../infrastructure/schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {}

  async createUser(input: {
    fullName: string;
    email: string;
    passwordHash: string;
  }): Promise<UserDocument> {
    const existingUser = await this.userModel.exists({ email: input.email });

    if (existingUser) {
      throw new ConflictException('Ya existe una cuenta con ese correo.');
    }

    const initialBalance = this.configService.get<number>(
      'INITIAL_BALANCE',
      100000,
    );

    return this.userModel.create({
      ...input,
      email: input.email.toLowerCase(),
      availableBalance: initialBalance,
      reservedBalance: 0,
    });
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

  toProfile(user: UserDocument) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      availableBalance: user.availableBalance,
      reservedBalance: user.reservedBalance,
    };
  }
}

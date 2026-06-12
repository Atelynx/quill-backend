import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Stock,
  StockSchema,
} from '../market/infrastructure/schemas/stock.schema';
import { UsersService } from './application/services/users.service';
import {
  Friendship,
  FriendshipSchema,
} from './infrastructure/schemas/friendship.schema';
import { User, UserSchema } from './infrastructure/schemas/user.schema';
import { UsersController } from './presentation/controllers/users.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Friendship.name, schema: FriendshipSchema },
      { name: Stock.name, schema: StockSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}

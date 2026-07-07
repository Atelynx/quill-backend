import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminConfigService } from './application/services/admin-config.service';
import {
  AdminConfig,
  AdminConfigSchema,
} from './infrastructure/schemas/admin-config.schema';
import {
  ConfigSnapshot,
  ConfigSnapshotSchema,
} from './infrastructure/schemas/config-snapshot.schema';
import { AdminController } from './presentation/controllers/admin.controller';
import { AdminSnapshotsController } from './presentation/controllers/admin-snapshots.controller';
import { AdminUsersController } from './presentation/controllers/admin-users.controller';
import { AdminStockController } from './presentation/controllers/admin-stock.controller';
import {
  User,
  UserSchema,
} from '../../modules/users/infrastructure/schemas/user.schema';
import { MarketModule } from '../../modules/market/market.module';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminConfig.name, schema: AdminConfigSchema },
      { name: ConfigSnapshot.name, schema: ConfigSnapshotSchema },
      { name: User.name, schema: UserSchema },
    ]),
    MarketModule,
  ],
  controllers: [
    AdminSnapshotsController,
    AdminController,
    AdminUsersController,
    AdminStockController,
  ],
  providers: [AdminConfigService],
  exports: [AdminConfigService],
})
export class AdminModule {}

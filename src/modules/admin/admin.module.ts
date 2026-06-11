import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminConfigService } from './application/services/admin-config.service';
import {
  AdminConfig,
  AdminConfigSchema,
} from './infrastructure/schemas/admin-config.schema';
import { AdminController } from './presentation/controllers/admin.controller';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminConfig.name, schema: AdminConfigSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminConfigService],
  exports: [AdminConfigService],
})
export class AdminModule {}

import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AdminConfigService } from '../../application/services/admin-config.service';
import {
  ConfigSnapshot,
  ConfigSnapshotDocument,
} from '../../infrastructure/schemas/config-snapshot.schema';
import { CreateSnapshotDto } from '../dto/create-snapshot.dto';

@Controller('admin/config/snapshots')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminSnapshotsController {
  constructor(
    private readonly adminConfigService: AdminConfigService,
    @InjectModel(ConfigSnapshot.name)
    private readonly snapshotModel: Model<ConfigSnapshotDocument>,
  ) {}

  @Get()
  async getAll() {
    return this.snapshotModel.find().sort({ createdAt: -1 }).exec();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const snapshot = await this.snapshotModel.findById(id).exec();
    if (!snapshot) {
      throw new NotFoundException('Snapshot no encontrado.');
    }
    return snapshot;
  }

  @Post()
  async create(@Body() dto: CreateSnapshotDto) {
    return this.adminConfigService.createManualSnapshot(dto.name);
  }

  @Post(':id/restore')
  async restore(@Param('id') id: string) {
    return this.adminConfigService.restoreSnapshot(id);
  }
}

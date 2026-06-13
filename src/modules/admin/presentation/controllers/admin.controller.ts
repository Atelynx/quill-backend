import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { AdminConfigService } from '../../application/services/admin-config.service';
import { CreateConfigDto } from '../dto/create-config.dto';
import { UpsertConfigDto } from '../dto/upsert-config.dto';

const RESTART_REQUIRED_KEYS = new Set([
  'MARKET_PROVIDER',
  'SIMULATION_STRATEGY',
]);

@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly adminConfigService: AdminConfigService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async getAll() {
    return this.adminConfigService.getAll();
  }

  @Get(':key')
  async getOne(@Param('key') key: string) {
    const doc = await this.adminConfigService.getFull(key);

    if (!doc) {
      throw new NotFoundException(`Configuración "${key}" no encontrada.`);
    }

    const response: Record<string, unknown> = {
      key: doc.key,
      value: doc.value,
      name: doc.name ?? null,
      tags: doc.tags ?? [],
      inUse: doc.inUse,
      lastUsedAt: doc.lastUsedAt ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    if (RESTART_REQUIRED_KEYS.has(key)) {
      response.effectiveValue = this.configService.get<unknown>(key, doc.value);
      response.appliesOn = 'restart';
    }

    return response;
  }

  @Get(':key/history')
  async getHistory(@Param('key') key: string) {
    return this.adminConfigService.getHistory(key);
  }

  @Post()
  async create(@Body() dto: CreateConfigDto) {
    return this.adminConfigService.set(dto.key, dto.value, {
      name: dto.name,
      tags: dto.tags,
    });
  }

  @Put(':key')
  async update(@Param('key') key: string, @Body() dto: UpsertConfigDto) {
    const existing = await this.adminConfigService.getFull(key);
    if (!existing) {
      throw new NotFoundException(`Configuración "${key}" no encontrada.`);
    }

    return this.adminConfigService.set(key, dto.value, {
      name: dto.name,
      tags: dto.tags,
    });
  }

  @Delete(':key')
  async remove(@Param('key') key: string) {
    const existing = await this.adminConfigService.getFull(key);
    if (!existing) {
      throw new NotFoundException(`Configuración "${key}" no encontrada.`);
    }

    await this.adminConfigService.delete(key);
    return { message: `Configuración "${key}" eliminada.` };
  }
}

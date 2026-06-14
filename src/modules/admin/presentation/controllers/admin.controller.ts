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
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../../common/interfaces/jwt-payload.interface';
import { AdminConfigService } from '../../application/services/admin-config.service';
import { ConfigResponseDto } from '../dto/config-response.dto';
import { CreateConfigDto } from '../dto/create-config.dto';
import { UpsertConfigDto } from '../dto/upsert-config.dto';
import {
  AdminConfigDocument,
  RESTART_REQUIRED_KEYS,
} from '../../infrastructure/schemas/admin-config.schema';



@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly adminConfigService: AdminConfigService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async getAll(): Promise<ConfigResponseDto[]> {
    const docs = await this.adminConfigService.getAll();
    return docs.map((doc) => this.toResponse(doc));
  }

  @Get(':key')
  async getOne(@Param('key') key: string): Promise<ConfigResponseDto> {
    const doc = await this.adminConfigService.getFull(key);

    if (!doc) {
      throw new NotFoundException(`Configuración "${key}" no encontrada.`);
    }

    return this.toResponse(doc);
  }

  private toResponse(doc: AdminConfigDocument): ConfigResponseDto {
    const response = new ConfigResponseDto();

    response.key = doc.key;
    response.value = doc.value;
    response.name = doc.name ?? null;
    response.tags = doc.tags ?? [];
    response.inUse = doc.inUse;
    response.lastUsedAt = doc.lastUsedAt ?? null;
    response.createdAt = doc.createdAt!;
    response.updatedAt = doc.updatedAt!;

    if (RESTART_REQUIRED_KEYS.has(doc.key)) {
      response.effectiveValue = doc.value ?? this.configService.get(doc.key, doc.value);
      response.appliesOn = 'restart';
    }

    return response;
  }

  @Get(':key/history')
  async getHistory(@Param('key') key: string) {
    return this.adminConfigService.getHistory(key);
  }

  @Post()
  async create(@Body() dto: CreateConfigDto, @CurrentUser() user: JwtPayload) {
    return this.adminConfigService.set(dto.key, dto.value, {
      name: dto.name,
      tags: dto.tags,
      updatedBy: user.sub,
    });
  }

  @Put(':key')
  async update(
    @Param('key') key: string,
    @Body() dto: UpsertConfigDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const existing = await this.adminConfigService.getFull(key);
    if (!existing) {
      throw new NotFoundException(`Configuración "${key}" no encontrada.`);
    }

    return this.adminConfigService.set(key, dto.value, {
      name: dto.name,
      tags: dto.tags,
      updatedBy: user.sub,
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

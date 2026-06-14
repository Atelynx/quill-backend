import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { MarketService } from '../../../market/application/services/market.service';
import { CreateStockDto } from '../dto/create-stock.dto';
import { UpdateStockPriceDto } from '../dto/update-stock-price.dto';

@Controller('admin/stocks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminStockController {
  constructor(
    private readonly marketService: MarketService,
  ) {}

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketService.listStocks({
      search,
      source,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post()
  async create(@Body() dto: CreateStockDto) {
    return this.marketService.createStock(dto);
  }

  @Patch(':symbol/price')
  async updatePrice(
    @Param('symbol') symbol: string,
    @Body() dto: UpdateStockPriceDto,
  ) {
    return this.marketService.updateStockPrice(symbol, dto.price);
  }

  @Delete(':symbol')
  async remove(@Param('symbol') symbol: string) {
    await this.marketService.deleteStock(symbol);
    return { message: `Stock "${symbol.toUpperCase()}" eliminado.` };
  }
}

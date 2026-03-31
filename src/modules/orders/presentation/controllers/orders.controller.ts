import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../common/interfaces/jwt-payload.interface';
import { OrdersService } from '../../application/services/orders.service';
import { CreateOrderDto } from '../dto/create-order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(@CurrentUser() payload: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(payload.sub, dto);
  }

  @Get()
  getOrders(
    @CurrentUser() payload: JwtPayload,
    @Query('status') status?: string,
  ) {
    return this.ordersService.listUserOrders(payload.sub, status);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  PipeTransform,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../common/interfaces/jwt-payload.interface';
import { ParseObjectIdPipe } from '../../../../common/pipes/parse-object-id.pipe';
import { OrdersService } from '../../application/services/orders.service';
import { CreateOrderDto } from '../dto/create-order.dto';

const ORDER_STATUSES = ['PENDING', 'EXECUTED', 'CANCELLED'] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

class ParseOrderStatusPipe implements PipeTransform<
  string | undefined,
  OrderStatus | undefined
> {
  transform(value: string | undefined): OrderStatus | undefined {
    if (!value) {
      return undefined;
    }

    const status = ORDER_STATUSES.find(
      (candidate) => candidate === value.toUpperCase(),
    );
    if (!status) {
      throw new BadRequestException('El estado de orden no es válido.');
    }

    return status;
  }
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(@CurrentUser() payload: JwtPayload, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(payload.sub, dto);
  }

  @Patch(':id/cancel')
  cancelOrder(
    @CurrentUser() payload: JwtPayload,
    @Param('id', ParseObjectIdPipe) orderId: string,
  ) {
    return this.ordersService.cancelOrder(payload.sub, orderId);
  }

  @Get()
  getOrders(
    @CurrentUser() payload: JwtPayload,
    @Query('status', new ParseOrderStatusPipe())
    status?: OrderStatus,
  ) {
    return this.ordersService.listUserOrders(payload.sub, status);
  }
}

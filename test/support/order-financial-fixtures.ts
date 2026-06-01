import type { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import request from 'supertest';
import { Order } from '../../src/modules/orders/infrastructure/schemas/order.schema';
import { Stock } from '../../src/modules/market/infrastructure/schemas/stock.schema';
import { Position } from '../../src/modules/portfolio/infrastructure/schemas/position.schema';
import { Trade } from '../../src/modules/trades/infrastructure/schemas/trade.schema';
import { User } from '../../src/modules/users/infrastructure/schemas/user.schema';
import type { OrderDocument } from '../../src/modules/orders/infrastructure/schemas/order.schema';
import type { StockDocument } from '../../src/modules/market/infrastructure/schemas/stock.schema';
import type { PositionDocument } from '../../src/modules/portfolio/infrastructure/schemas/position.schema';
import type { TradeDocument } from '../../src/modules/trades/infrastructure/schemas/trade.schema';
import type { UserDocument } from '../../src/modules/users/infrastructure/schemas/user.schema';

export interface FinancialModels {
  orderModel: Model<OrderDocument>;
  stockModel: Model<StockDocument>;
  positionModel: Model<PositionDocument>;
  tradeModel: Model<TradeDocument>;
  userModel: Model<UserDocument>;
}

export function getFinancialModels(app: INestApplication): FinancialModels {
  return {
    orderModel: app.get<Model<OrderDocument>>(getModelToken(Order.name)),
    stockModel: app.get<Model<StockDocument>>(getModelToken(Stock.name)),
    positionModel: app.get<Model<PositionDocument>>(
      getModelToken(Position.name),
    ),
    tradeModel: app.get<Model<TradeDocument>>(getModelToken(Trade.name)),
    userModel: app.get<Model<UserDocument>>(getModelToken(User.name)),
  };
}

export async function registerAndLogin(
  app: INestApplication,
  email: string,
) {
  const server = app.getHttpServer() as Parameters<typeof request>[0];
  const credentials = {
    fullName: 'Usuario Financiero',
    email,
    password: 'Password123',
  };

  await request(server).post('/api/auth/register').send(credentials).expect(201);
  const loginResponse = await request(server)
    .post('/api/auth/login')
    .send({ email, password: credentials.password })
    .expect(201);

  const { userModel } = getFinancialModels(app);
  const user = await userModel.findOne({ email }).exec();

  return {
    token: loginResponse.body.accessToken as string,
    user: user as UserDocument,
    server,
  };
}

export async function createStock(
  app: INestApplication,
  symbol: string,
  close: number,
) {
  const { stockModel } = getFinancialModels(app);

  return stockModel.create({
    symbol,
    name: `${symbol} Test`,
    currency: 'CLP',
    close,
    previousClose: close,
    dayChangePercentage: 0,
    source: 'test',
  });
}

export async function createPosition(
  app: INestApplication,
  userId: unknown,
  symbol: string,
  quantity: number,
  reservedQuantity = 0,
) {
  const { positionModel } = getFinancialModels(app);

  return positionModel.create({
    userId: userId as Types.ObjectId,
    symbol,
    quantity,
    reservedQuantity,
    averageCost: 80,
  });
}

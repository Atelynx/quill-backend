import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type AdminConfigDocument = HydratedDocument<AdminConfig>;

export const RESTART_REQUIRED_KEYS = new Set([
  'MARKET_PROVIDER',
  'SIMULATION_STRATEGY',
  'CURRENCY_PROVIDER',
  'CURRENCY_SIMULATION_STRATEGY'
]);

export const SEED_CONFIGS: Array<{
  key: string;
  envKey: string;
  defaultValue: string | number;
  name: string;
  tags: string[];
}> = [
    {
      key: 'COMMISSION_RATE',
      envKey: 'COMMISSION_RATE',
      defaultValue: 0.005,
      name: 'Comisión de trading',
      tags: ['trading', 'fees'],
    },
    {
      key: 'INITIAL_BALANCE',
      envKey: 'INITIAL_BALANCE',
      defaultValue: 100000,
      name: 'Balance inicial',
      tags: ['users', 'registration'],
    },
    {
      key: 'MARKET_HOURS_OPEN',
      envKey: 'MARKET_HOURS_OPEN',
      defaultValue: '09:30',
      name: 'Horario apertura mercado',
      tags: ['market', 'hours'],
    },
    {
      key: 'MARKET_HOURS_CLOSED',
      envKey: 'MARKET_HOURS_CLOSED',
      defaultValue: '16:00',
      name: 'Horario cierre mercado',
      tags: ['market', 'hours'],
    },
    {
      key: 'MARKET_PROVIDER',
      envKey: 'MARKET_PROVIDER',
      defaultValue: 'mock',
      name: 'Proveedor de datos de mercado',
      tags: ['market', 'provider'],
    },
    {
      key: 'SIMULATION_STRATEGY',
      envKey: 'SIMULATION_STRATEGY',
      defaultValue: 'flat',
      name: 'Estrategia de simulación',
      tags: ['market', 'simulation'],
    },
    {
      key: 'CURRENCY_SIMULATION_STRATEGY',
      envKey: 'CURRENCY_SIMULATION_STRATEGY',
      defaultValue: 'flat',
      name: 'Estrategia de simulación de monedas',
      tags: ['market', 'simulation'],
    },
    {
      key: 'CURRENCY_PROVIDER',
      envKey: 'CURRENCY_PROVIDER',
      defaultValue: 'mock',
      name: 'Proveedor de datos de monedas',
      tags: ['currency', 'provider'],
    },
  ];

@Schema({ collection: 'admin_configs', timestamps: true })
export class AdminConfig {
  @Prop({ required: true })
  key!: string;

  @Prop({ required: true, type: SchemaTypes.Mixed })
  value!: unknown;

  @Prop()
  name?: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ type: Boolean, default: true })
  inUse!: boolean;

  @Prop({ type: Date })
  lastUsedAt?: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  createdAt?: Date;

  updatedAt?: Date;
}

const schema = SchemaFactory.createForClass(AdminConfig);

schema.index({ key: 1, inUse: 1 });
schema.index({ key: 1, createdAt: -1 });

export const AdminConfigSchema = schema;

import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AdminConfig,
  AdminConfigDocument,
} from '../../infrastructure/schemas/admin-config.schema';
import {
  ConfigSnapshot,
  ConfigSnapshotDocument,
} from '../../infrastructure/schemas/config-snapshot.schema';
import { envValidationSchema } from '../../../../config/env.validation';

@Injectable()
export class AdminConfigService implements OnModuleInit {
  private readonly logger = new Logger(AdminConfigService.name);

  constructor(
    @InjectModel(AdminConfig.name)
    private readonly adminConfigModel: Model<AdminConfigDocument>,
    @InjectModel(ConfigSnapshot.name)
    private readonly snapshotModel: Model<ConfigSnapshotDocument>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const description = envValidationSchema.describe();
    const adminConfigKeys = Object.entries(description.keys)
      .filter(([_, schema]: [string, any]) =>
        schema.metas?.some((meta: any) => meta.adminConfig === true),
      )
      .map(([key]) => key);

    for (const key of adminConfigKeys) {
      const exists = await this.adminConfigModel
        .exists({ key, inUse: true })
        .exec();

      if (!exists) {
        let value = this.configService.get(key);
        if (value === undefined || value === null) {
          const keySchema = description.keys[key] as any;
          value = keySchema?.flags?.default;
        }
        if (value === undefined || value === null) {
          if (key.includes('PROVIDER')) {
            value = 'mock';
          } else if (key.includes('STRATEGY')) {
            value = 'flat';
          }
        }

        const name = this.formatFriendlyName(key);
        const tags = this.formatTags(key);

        await this.adminConfigModel.create({
          key,
          value,
          name,
          tags,
          inUse: true,
        });

        this.logger.log(
          `Seeded dynamic config from env: ${key}=${JSON.stringify(value)}`,
        );
      }
    }
  }

  private formatFriendlyName(key: string): string {
    return key
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatTags(key: string): string[] {
    return key.toLowerCase().split('_');
  }

  async get(key: string): Promise<any> {
    const doc = await this.adminConfigModel
      .findOneAndUpdate(
        { key, inUse: true },
        { $set: { lastUsedAt: new Date() } },
        { sort: { createdAt: -1 }, returnDocument: 'after' },
      )
      .exec();

    return doc?.value ?? null;
  }

  async getFull(key: string): Promise<AdminConfigDocument | null> {
    return this.adminConfigModel
      .findOneAndUpdate(
        { key, inUse: true },
        { $set: { lastUsedAt: new Date() } },
        { sort: { createdAt: -1 }, returnDocument: 'after' },
      )
      .exec();
  }

  async set(
    key: string,
    value: any,
    options?: {
      name?: string;
      tags?: string[];
      updatedBy?: string;
      createSnapshot?: boolean;
    },
  ): Promise<AdminConfigDocument> {
    await this.adminConfigModel
      .updateMany({ key }, { $set: { inUse: false } })
      .exec();

    const [doc] = await this.adminConfigModel.create([
      {
        key,
        value,
        name: options?.name,
        tags: options?.tags,
        inUse: true,
        updatedBy: options?.updatedBy as any,
      },
    ]);

    const shouldSnapshot = options?.createSnapshot ?? true;
    if (shouldSnapshot) {
      const label = options?.name ?? value;
      await this.createManualSnapshot(
        `Auto · ${key} → ${JSON.stringify(label)}`,
      );
    }

    return doc;
  }

  async getHistory(key: string): Promise<AdminConfigDocument[]> {
    return this.adminConfigModel.find({ key }).sort({ createdAt: -1 }).exec();
  }

  async getAll(): Promise<AdminConfigDocument[]> {
    return this.adminConfigModel.find({ inUse: true }).sort({ key: 1 }).exec();
  }

  async delete(key: string): Promise<void> {
    await this.adminConfigModel.deleteMany({ key }).exec();
  }

  async createManualSnapshot(
    name?: string,
    createdBy?: string,
  ): Promise<ConfigSnapshotDocument> {
    const activeConfigs = await this.adminConfigModel
      .find({ inUse: true })
      .lean()
      .exec();

    const configs: Record<string, any> = {};
    for (const c of activeConfigs) {
      configs[c.key] = c.value;
    }

    const [snapshot] = await this.snapshotModel.create([
      {
        configs,
        name: name ?? `Manual · ${new Date().toISOString()}`,
        createdBy: createdBy
          ? (new Types.ObjectId(createdBy) as any)
          : undefined,
      },
    ]);

    return snapshot;
  }

  async restoreSnapshot(snapshotId: string): Promise<ConfigSnapshotDocument> {
    const snapshot = await this.snapshotModel.findById(snapshotId).exec();

    if (!snapshot) {
      throw new NotFoundException('Snapshot no encontrado.');
    }

    for (const [key, value] of Object.entries(snapshot.configs)) {
      await this.set(key, value, { createSnapshot: false });
    }

    const [audit] = await this.snapshotModel.create([
      {
        configs: { ...snapshot.configs },
        name: `Restore · ${snapshot.name ?? snapshotId}`,
      },
    ]);

    return audit;
  }

  async markUsed(key: string): Promise<void> {
    await this.adminConfigModel
      .updateOne({ key, inUse: true }, { $set: { lastUsedAt: new Date() } })
      .exec();
  }
}

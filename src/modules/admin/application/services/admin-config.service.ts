import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import {
  AdminConfig,
  AdminConfigDocument,
} from '../../infrastructure/schemas/admin-config.schema';
import {
  ConfigSnapshot,
  ConfigSnapshotDocument,
} from '../../infrastructure/schemas/config-snapshot.schema';
import { validateAdminConfigValue } from './admin-config-value.validation';
import { SEED_CONFIGS } from '../../infrastructure/seed/seed.type';

@Injectable()
export class AdminConfigService implements OnModuleInit {
  private readonly logger = new Logger(AdminConfigService.name);

  constructor(
    @InjectModel(AdminConfig.name)
    private readonly adminConfigModel: Model<AdminConfigDocument>,
    @InjectModel(ConfigSnapshot.name)
    private readonly snapshotModel: Model<ConfigSnapshotDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const config of SEED_CONFIGS) {
      const exists = await this.adminConfigModel
        .exists({ key: config.key, inUse: true })
        .exec();

      if (!exists) {
        // this.logger.log(`Key ${config.key} is not found in DB, attempting to create a new and store it`);

        const value = this.configService.get<string | number>(
          config.key,
          config.defaultValue,
        );

        await this.adminConfigModel.create({
          key: config.key,
          value,
          name: config.name,
          tags: config.tags,
          inUse: true,
        });

        this.logger.log(
          `Seeded default config: ${config.key}=${JSON.stringify(value)}`,
        );
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const doc = await this.adminConfigModel
      .findOneAndUpdate(
        { key, inUse: true },
        { $set: { lastUsedAt: new Date() } },
        { sort: { createdAt: -1 }, returnDocument: 'after' },
      )
      .exec();

    return doc ? (doc.value as T) : null;
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
    value: unknown,
    options?: {
      name?: string;
      tags?: string[];
      updatedBy?: string;
      createSnapshot?: boolean;
    },
  ): Promise<AdminConfigDocument> {
    validateAdminConfigValue(key, value);

    const session = await this.connection.startSession();
    try {
      let createdConfig: AdminConfigDocument | undefined;
      await session.withTransaction(async () => {
        await this.adminConfigModel
          .updateMany({ key, inUse: true }, { $set: { inUse: false } })
          .session(session)
          .exec();

        [createdConfig] = await this.adminConfigModel.create(
          [this.buildConfig(key, value, options)],
          { session },
        );

        if (options?.createSnapshot ?? true) {
          const label = options?.name ?? value;
          await this.createSnapshot(
            `Auto · ${key} → ${JSON.stringify(label)}`,
            undefined,
            session,
          );
        }
      });

      if (!createdConfig) {
        throw new Error('No se pudo crear la configuración.');
      }
      return createdConfig;
    } finally {
      await session.endSession();
    }
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
    return this.createSnapshot(name, createdBy);
  }

  async restoreSnapshot(snapshotId: string): Promise<ConfigSnapshotDocument> {
    const snapshot = await this.snapshotModel.findById(snapshotId).exec();

    if (!snapshot) {
      throw new NotFoundException('Snapshot no encontrado.');
    }

    const configs = Object.entries(snapshot.configs);
    for (const [key, value] of configs) {
      validateAdminConfigValue(key, value);
    }

    const session = await this.connection.startSession();
    try {
      let audit: ConfigSnapshotDocument | undefined;
      await session.withTransaction(async () => {
        await this.adminConfigModel
          .updateMany({ inUse: true }, { $set: { inUse: false } })
          .session(session)
          .exec();

        if (configs.length) {
          await this.adminConfigModel.create(
            configs.map(([key, value]) => this.buildConfig(key, value)),
            { session },
          );
        }

        [audit] = await this.snapshotModel.create(
          [
            {
              configs: { ...snapshot.configs },
              name: `Restore · ${snapshot.name ?? snapshotId}`,
            },
          ],
          { session },
        );
      });

      if (!audit) {
        throw new Error('No se pudo auditar la restauración.');
      }
      return audit;
    } finally {
      await session.endSession();
    }
  }

  async markUsed(key: string): Promise<void> {
    await this.adminConfigModel
      .updateOne({ key, inUse: true }, { $set: { lastUsedAt: new Date() } })
      .exec();
  }

  private buildConfig(
    key: string,
    value: unknown,
    options?: { name?: string; tags?: string[]; updatedBy?: string },
  ) {
    return {
      key,
      value,
      name: options?.name,
      tags: options?.tags,
      inUse: true,
      updatedBy: options?.updatedBy
        ? new Types.ObjectId(options.updatedBy)
        : undefined,
    };
  }

  private async createSnapshot(
    name?: string,
    createdBy?: string,
    session?: ClientSession,
  ): Promise<ConfigSnapshotDocument> {
    const query = this.adminConfigModel.find({ inUse: true }).lean();
    if (session) query.session(session);
    const activeConfigs = await query.exec();
    const configs = Object.fromEntries(
      activeConfigs.map((config) => [config.key, config.value]),
    );

    const [snapshot] = await this.snapshotModel.create(
      [
        {
          configs,
          name: name ?? `Manual · ${new Date().toISOString()}`,
          createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
        },
      ],
      session ? { session } : undefined,
    );
    return snapshot;
  }
}

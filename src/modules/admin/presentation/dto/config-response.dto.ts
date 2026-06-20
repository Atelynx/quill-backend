export class ConfigResponseDto {
  key!: string;
  value!: unknown;
  name!: string | null;
  tags!: string[];
  inUse!: boolean;
  lastUsedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
  effectiveValue?: unknown;
  appliesOn?: 'restart';
}

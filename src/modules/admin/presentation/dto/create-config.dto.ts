import { MinLength, IsString } from 'class-validator';
import { UpsertConfigDto } from './upsert-config.dto';

export class CreateConfigDto extends UpsertConfigDto {
  @IsString()
  @MinLength(1)
  key!: string;
}

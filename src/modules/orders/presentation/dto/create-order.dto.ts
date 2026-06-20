import {
  IsEnum,
  IsDefined,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @Length(1, 20)
  symbol!: string;

  @IsEnum(['BUY', 'SELL'])
  side!: 'BUY' | 'SELL';

  @IsNumber()
  @IsInt()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsEnum(['LIMIT', 'MARKET'])
  type?: 'LIMIT' | 'MARKET';

  @ValidateIf((order: CreateOrderDto) => order.type !== 'MARKET')
  @IsDefined()
  @IsNumber()
  @IsPositive()
  @Min(0.01)
  limitPrice?: number;
}

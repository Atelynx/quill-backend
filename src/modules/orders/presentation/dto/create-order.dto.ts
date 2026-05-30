import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @Length(1, 20)
  symbol!: string;

  @IsEnum(['BUY', 'SELL'])
  side!: 'BUY' | 'SELL';

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsEnum(['LIMIT', 'MARKET'])
  type?: 'LIMIT' | 'MARKET';

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  limitPrice?: number;
}

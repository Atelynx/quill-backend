import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @Length(1, 10)
  symbol!: string;

  @IsEnum(['BUY', 'SELL'])
  side!: 'BUY' | 'SELL';

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @Min(0.01)
  limitPrice!: number;
}

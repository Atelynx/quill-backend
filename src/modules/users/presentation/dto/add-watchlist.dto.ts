import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class AddWatchlistDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  @Matches(/^[A-Za-z0-9][A-Za-z0-9.-]*$/, {
    each: true,
    message:
      'Cada símbolo debe contener solo letras, números, puntos y guiones.',
  })
  symbols!: string[];
}

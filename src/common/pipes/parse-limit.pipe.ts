import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseLimitPipe implements PipeTransform<
  string | undefined,
  number
> {
  constructor(
    private readonly defaultValue: number,
    private readonly maxValue: number,
  ) {}

  transform(value: string | undefined): number {
    if (value === undefined || value === '') {
      return this.defaultValue;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > this.maxValue) {
      throw new BadRequestException(
        `El límite debe ser un entero entre 1 y ${this.maxValue}.`,
      );
    }

    return parsed;
  }
}

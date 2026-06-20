import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ParseLimitPipe } from './parse-limit.pipe';
import { ParseObjectIdPipe } from './parse-object-id.pipe';

describe('common pipes', () => {
  it('valida límites y aplica el valor por defecto', () => {
    const pipe = new ParseLimitPipe(20, 100);

    expect(pipe.transform(undefined)).toBe(20);
    expect(pipe.transform('50')).toBe(50);
    expect(() => pipe.transform('101')).toThrow(BadRequestException);
    expect(() => pipe.transform('1.5')).toThrow(BadRequestException);
  });

  it('rechaza paginacion administrativa invalida', () => {
    const pagePipe = new ParseLimitPipe(1, 10000);
    const limitPipe = new ParseLimitPipe(50, 200);

    for (const invalid of ['NaN', '0', '-1', '1.5', '10001']) {
      expect(() => pagePipe.transform(invalid)).toThrow(BadRequestException);
    }
    expect(() => limitPipe.transform('201')).toThrow(BadRequestException);
    expect(limitPipe.transform('200')).toBe(200);
  });

  it('acepta ObjectId válidos y rechaza identificadores inválidos', () => {
    const pipe = new ParseObjectIdPipe();
    const id = new Types.ObjectId().toString();

    expect(pipe.transform(id)).toBe(id);
    expect(() => pipe.transform('invalid-id')).toThrow(BadRequestException);
  });
});

import { validate } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

describe('CreateOrderDto validation', () => {
  const createDto = (values: Partial<CreateOrderDto>) =>
    Object.assign(new CreateOrderDto(), {
      symbol: 'AAPL',
      side: 'BUY',
      quantity: 1,
      ...values,
    });

  it('should reject an empty DTO instance', async () => {
    const errors = await validate(new CreateOrderDto());

    expect(errors.length).toBeGreaterThan(0);
  });

  it('rechaza una orden LIMIT sin limitPrice', async () => {
    const errors = await validate(createDto({ type: 'LIMIT' }));

    expect(errors.some((error) => error.property === 'limitPrice')).toBe(true);
  });

  it('acepta una orden LIMIT con limitPrice', async () => {
    const errors = await validate(
      createDto({ type: 'LIMIT', limitPrice: 100 }),
    );

    expect(errors).toHaveLength(0);
  });

  it('acepta una orden MARKET sin limitPrice', async () => {
    const errors = await validate(createDto({ type: 'MARKET' }));

    expect(errors).toHaveLength(0);
  });

  it.each([0, -1])('rechaza limitPrice inválido: %s', async (limitPrice) => {
    const errors = await validate(createDto({ type: 'LIMIT', limitPrice }));

    expect(errors.some((error) => error.property === 'limitPrice')).toBe(true);
  });

  it('rechaza cantidades no enteras', async () => {
    const errors = await validate(
      createDto({ type: 'LIMIT', limitPrice: 100, quantity: 1.5 }),
    );

    expect(errors.some((error) => error.property === 'quantity')).toBe(true);
  });
});

import { validate } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

describe('CreateOrderDto validation', () => {
  it('should reject an empty DTO instance', async () => {
    const errors = await validate(new CreateOrderDto());

    expect(errors.length).toBeGreaterThan(0);
  });
});

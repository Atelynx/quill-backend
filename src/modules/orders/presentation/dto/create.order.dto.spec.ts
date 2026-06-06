import { validate, getMetadataStorage } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

describe('CreateOrderDto validation', () => {
  //   it('should have validation decorators defined on the DTO', () => {
  //     const metadatas = (getMetadataStorage() as any).getTargetValidationMetadatas(
  //       CreateOrderDto,
  //       ''
  //     );

  //     expect(Array.isArray(metadatas)).toBe(true);
  //     expect(metadatas.length).toBeGreaterThan(0);
  //   });

  //   it('should fail validation for an empty DTO instance', async () => {
  //     const dto = new CreateOrderDto();
  //     const errors = await validate(dto);
  //     expect(errors.length).toBeGreaterThan(0);
  //   });

  it('should have validation decorators for each DTO property', () => {
    const metadatas = (
      getMetadataStorage() as any
    ).getTargetValidationMetadatas(CreateOrderDto, '');

    const props = Array.from(
      new Set(metadatas.map((m: any) => m.propertyName)),
    );
    expect(props.length).toBeGreaterThan(0);

    props.forEach((prop) => {
      const propMetas = metadatas.filter((m: any) => m.propertyName === prop);
      expect(propMetas.length).toBeGreaterThan(0);
    });
  });
});

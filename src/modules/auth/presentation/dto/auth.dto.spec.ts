import { validate, getMetadataStorage } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

describe('Auth Data transfer object validation', () => {


  it('should have validation decorators for each DTO property', () => {
    const metadatas = (getMetadataStorage() as any).getTargetValidationMetadatas(
      LoginDto,
      RegisterDto
      
    );

    const props = Array.from(new Set(metadatas.map((m: any) => m.propertyName)));
    expect(props.length).toBeGreaterThan(0);

    props.forEach((prop) => {
      const propMetas = metadatas.filter((m: any) => m.propertyName === prop);
      expect(propMetas.length).toBeGreaterThan(0);
    });
  });
});

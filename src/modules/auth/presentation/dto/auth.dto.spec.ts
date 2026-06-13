import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

describe('Auth Data transfer object validation', () => {
  it.each([LoginDto, RegisterDto])(
    'should reject an empty %p',
    async (DtoClass) => {
      const errors = await validate(new DtoClass());

      expect(errors.length).toBeGreaterThan(0);
    },
  );

  it('should validate a complete login request', async () => {
    const dto = Object.assign(new LoginDto(), {
      email: 'usuario@example.com',
      password: 'Password123!',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});

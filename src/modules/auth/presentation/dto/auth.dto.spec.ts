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

  it('should accept register fields at their maximum valid lengths', async () => {
    const dto = Object.assign(new RegisterDto(), {
      fullName: 'A'.repeat(100),
      email: 'maximum.valid@example.com',
      password: 'P'.repeat(128),
      username: 'u'.repeat(30),
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('should reject register fields above their maximum lengths', async () => {
    const dto = Object.assign(new RegisterDto(), {
      fullName: 'A'.repeat(101),
      email: `${'a'.repeat(243)}@example.com`,
      password: 'P'.repeat(129),
      username: 'u'.repeat(31),
    });

    expect(await validate(dto)).toHaveLength(4);
  });
});

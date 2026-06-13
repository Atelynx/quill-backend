import { validateAdminPassword } from './admin-password';

describe('validateAdminPassword', () => {
  it('acepta una contraseña segura', () => {
    expect(validateAdminPassword('AdminSeguro123')).toBe('AdminSeguro123');
  });

  it.each([undefined, 'admin123', 'solo-minusculas-123', 'SINMINUSCULAS123'])(
    'rechaza una contraseña insegura',
    (password) => {
      expect(() => validateAdminPassword(password)).toThrow();
    },
  );
});

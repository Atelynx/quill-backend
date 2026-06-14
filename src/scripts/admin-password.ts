const MIN_PASSWORD_LENGTH = 12;

export function validateAdminPassword(password: string | undefined): string {
  if (!password) {
    throw new Error('La contraseña es obligatoria.');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  }

  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new Error(
      'La contraseña debe incluir mayúsculas, minúsculas y números.',
    );
  }

  return password;
}

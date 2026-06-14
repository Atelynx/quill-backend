import * as dotenv from 'dotenv';
import passwordGenerator from 'generate-password-ts';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { resolveEnvFilePaths } from '../config/env-file-paths';
import { normalizeMongoDbUri } from '../config/normalize-mongodb-uri';
import { validateAdminPassword } from './admin-password';
import { upsertAdminUser } from './admin-user-upsert';
import { input } from './input';


function loadMongoDbUri(): string {
  const envPaths = resolveEnvFilePaths();
  const envPath =
    envPaths.find((p) => {
      try {
        return existsSync(p);
      } catch {
        return false;
      }
    }) ?? resolve(process.cwd(), '.env');

  const loaded = dotenv.config({ path: envPath });

  if (loaded.error) {
    console.warn(
      'No se pudo cargar .env, usando variables de entorno existentes.',
    );
  }

  const mongoDbUri = process.env.MONGODB_URI;
  if (!mongoDbUri) {
    throw new Error('MONGODB_URI no está definida en el entorno.');
  }

  return normalizeMongoDbUri(mongoDbUri);
}

function parseArgs(): {
  email: string;
  username?: string;
  password?: string;
} {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};

  for (const arg of args) {
    const [key, value] = arg.split('=');
    parsed[key.replace(/^--/, '')] = value;
  }

  return {
    email: parsed.email,
    username: parsed.username,
    password: parsed.password,
  };
}


async function main(): Promise<void> {
  let { email, username, password } = parseArgs();

  if (!email) {
    console.log('Modo interactivo — ingresa los datos del admin.');
    email = await input('Email: ');
    username = await input('Username (opcional): ');
  }

  if (!email) {
    console.error('Error: Email es requerido.');
    console.error(
      'Uso: npm run create:admin -- --email=user@example.com [--username=admin] [--password=secreto123]',
    );
    process.exit(1);
  }

  if (!password) {
    password = passwordGenerator.generate({
      length: 16,
      numbers: true,
      symbols: false,
      lowercase: true,
      uppercase: true,
      strict: true,
    });
    console.log(`Password generado automáticamente: ${password}`);
  } else {
    password = validateAdminPassword(password);
  }

  const uri = loadMongoDbUri();

  await upsertAdminUser({
    uri,
    email,
    username,
    password,
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  console.error('Error:', message);
  process.exit(1);
});

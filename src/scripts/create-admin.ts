import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { resolveEnvFilePaths } from '../config/env-file-paths';
import { normalizeMongoDbUri } from '../config/normalize-mongodb-uri';

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

  if (!parsed.email) {
    console.error('Uso: npm run create:admin -- --email=user@example.com [--username=admin] [--password=secreto123]');
    process.exit(1);
  }

  return {
    email: parsed.email,
    username: parsed.username,
    password: parsed.password,
  };
}

async function main(): Promise<void> {
  const { email, username, password } = parseArgs();

  const envPaths = resolveEnvFilePaths();
  const loaded = dotenv.config({ path: envPaths.find((p) => {
    try { return require('fs').existsSync(p); } catch { return false; }
  }) ?? resolve(process.cwd(), '.env') });

  if (loaded.error) {
    console.warn('No se pudo cargar .env, usando variables de entorno existentes.');
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI no está definida en el entorno.');
    process.exit(1);
  }

  const uri = normalizeMongoDbUri(MONGODB_URI);
  await mongoose.connect(uri);
  console.log('Conectado a MongoDB.');

  const db = mongoose.connection.db!;
  const usersCollection = db.collection('users');

  const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });

  if (existingUser) {
    await usersCollection.updateOne(
      { _id: existingUser._id },
      { $set: { role: 'admin' } },
    );
    console.log(`Usuario "${email}" actualizado a rol admin.`);
  } else {
    const passwordHash = password
      ? await bcrypt.hash(password, 10)
      : await bcrypt.hash('admin123', 10);

    await usersCollection.insertOne({
      fullName: username ?? 'Admin',
      email: email.toLowerCase(),
      username: (username ?? `admin_${Math.random().toString(36).slice(2, 8)}`).toLowerCase(),
      passwordHash,
      role: 'admin',
      availableBalance: 0,
      reservedBalance: 0,
      watchlist: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Usuario admin "${email}" creado.`);
  }

  await mongoose.disconnect();
  console.log('Desconectado de MongoDB.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

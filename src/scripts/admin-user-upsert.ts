import * as bcrypt from 'bcrypt';
import mongoose from 'mongoose';

export async function upsertAdminUser(params: {
  uri: string;
  email: string;
  username?: string;
  password: string;
}): Promise<void> {
  const { uri, email, username, password } = params;

  await mongoose.connect(uri);
  console.log('Conectado a MongoDB.');

  try {
    const usersCollection = mongoose.connection.db!.collection('users');
    const normalizedEmail = email.toLowerCase();
    const existingUser = await usersCollection.findOne({ email: normalizedEmail });

    if (existingUser) {
      await usersCollection.updateOne(
        { _id: existingUser._id },
        { $set: { role: 'admin' } },
      );
      console.log(`Usuario "${email}" actualizado a rol admin.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await usersCollection.insertOne({
      fullName: username ?? 'Admin',
      email: normalizedEmail,
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
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado de MongoDB.');
  }
}
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { stdin, stdout } from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import User from '../models/User.js';

export async function bootstrapAdmin(fields) {
  const { username, email, password, country, city, phone } = fields;
  for (const value of [username, email, country, city, phone]) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('All account fields are required.');
  }
  if (typeof password !== 'string' || password.length < 8) throw new Error('Use a password of at least 8 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Enter a valid email address.');
  if (!/^\d+$/.test(phone.trim())) throw new Error('Phone must contain digits only.');
  if (await User.exists({ isAdmin: true })) throw new Error('An administrator already exists. Ask that administrator to manage access.');
  if (await User.exists({ $or: [{ username: username.trim() }, { email: email.trim() }] })) {
    throw new Error('That username or email already exists. No account was changed.');
  }
  const user = new User({
    username: username.trim(), email: email.trim(), country: country.trim(), city: city.trim(),
    phone: phone.trim(), password: await bcrypt.hash(password, 10), isAdmin: true,
  });
  await user.save();
}

async function main() {
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
  if (!process.env.MONGO) throw new Error('Configure MONGO in api/.env first.');
  if (!stdin.isTTY) throw new Error('Run npm run admin:bootstrap in an interactive terminal.');
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, done) {
    if (!hidden) stdout.write(chunk, encoding);
    done();
  } });
  const prompt = createInterface({ input: stdin, output, terminal: true });
  try {
    console.log('Create the first administrator in the database configured in api/.env.');
    const fields = {};
    for (const [key, label] of Object.entries({ username: 'Username', email: 'Email', country: 'Country', city: 'City', phone: 'Phone (digits only)' })) {
      fields[key] = await prompt.question(label + ': ');
    }
    stdout.write('Password (hidden): ');
    hidden = true;
    fields.password = await prompt.question('');
    hidden = false;
    stdout.write('\nConfirm password (hidden): ');
    hidden = true;
    const confirmation = await prompt.question('');
    hidden = false;
    stdout.write('\n');
    if (fields.password !== confirmation) throw new Error('Passwords do not match.');
    if ((await prompt.question('Create this administrator? Type CREATE to confirm: ')).trim() !== 'CREATE') {
      console.log('Cancelled. No account was changed.');
      return;
    }
    try { await mongoose.connect(process.env.MONGO, { serverSelectionTimeoutMS: 10000 }); }
    catch { throw new Error('Unable to connect to the configured database.'); }
    await bootstrapAdmin(fields);
    console.log('Administrator created. You can now log in to the admin app.');
  } finally {
    hidden = false;
    prompt.close();
    await mongoose.disconnect();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    const message = error.code === 11000 ? 'That username or email already exists. No account was changed.'
      : error.name === 'ValidationError' ? 'Invalid account details. No account was created.'
      : error.name === 'Error' ? error.message : 'Unable to create an administrator. No credentials were logged.';
    console.error(message);
    process.exitCode = 1;
  });
}

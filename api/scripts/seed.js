import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import Farm from '../models/Farm.js';

export const DEMO_PASSWORD = 'DemoStay!2026';
const models = { users: User, rooms: Room, hotels: Hotel, farms: Farm };
const id = key => new mongoose.Types.ObjectId(createHash('sha256').update('booknrest:demo:v1:' + key).digest('hex').slice(0, 24));
const photo = key => `https://images.unsplash.com/${key}?auto=format&fit=crop&w=1200&q=80`;
const photos = [photo('photo-1566073771259-6a8506099945'), photo('photo-1564013799919-ab600027ffc6'), photo('photo-1449158743715-0a90ebb6d2d8')];

// Stable IDs plus insert-only upserts make reruns safe for edited demo records
// and preserve bookings, passwords, existing administrators and other data.
export function buildSeedData(passwordHash, now = new Date()) {
  const data = { users: [], rooms: [], hotels: [], farms: [] };
  const profiles = [
    ['alex', 'colombo', 'Sri Lanka'], ['maya', 'kandy', 'Sri Lanka'],
    ['ravi', 'chennai', 'India'], ['priya', 'banglore', 'India'],
    ['emma', 'london', 'United Kingdom'], ['noah', 'london', 'United Kingdom'],
    ['sara', 'galle', 'Sri Lanka'], ['liam', 'nuwara eliya', 'Sri Lanka'],
  ];
  data.users = profiles.map(([name, city, country], index) => ({
    _id: id('user:' + name), username: 'demo_' + name, email: `demo_${name}@example.test`,
    password: passwordHash, country, city, phone: 94770000001 + index, img: '', isAdmin: false,
    createdAt: now, updatedAt: now,
  }));

  const makeRooms = (key, basePrice) => [0, 1].map(tier => {
    const room = {
      _id: id('room:' + key + ':' + tier), title: tier ? 'Demo Family Suite' : 'Demo Standard Double',
      price: tier ? Math.round(basePrice * 1.6) : basePrice, maxpeople: tier ? 4 : 2,
      desc: tier ? 'Sample family suite with two beds, a lounge and free Wi-Fi.' : 'Sample double room with a private bathroom, air conditioning and free Wi-Fi.',
      roomNumbers: [1, 2, 3].map(number => ({
        _id: id('number:' + key + ':' + tier + ':' + number), number: (tier + 1) * 100 + number,
        unavailableDates: number === 3 ? [7, 8].map(offset => {
          const day = new Date(now);
          day.setUTCHours(0, 0, 0, 0);
          day.setUTCDate(day.getUTCDate() + offset);
          return day;
        }) : [],
      })), createdAt: now, updatedAt: now,
    };
    data.rooms.push(room);
    return room._id.toString();
  });

  const hotels = [
    ['chennai-marina', 'Demo Chennai Marina Hotel', 'hotel', 'chennai', 65, true],
    ['chennai-coast', 'Demo Chennai Coast Resort', 'resort', 'chennai', 110, false],
    ['london-riverside', 'Demo London Riverside Hotel', 'hotel', 'london', 140, true],
    ['london-city', 'Demo London City Apartment', 'apartment', 'london', 95, false],
    ['banglore-garden', 'Demo Bangalore Garden Villa', 'villa', 'banglore', 85, true],
    ['banglore-central', 'Demo Bangalore Central Hotel', 'hotel', 'banglore', 55, false],
    ['colombo-ocean', 'Demo Colombo Ocean Hotel', 'hotel', 'colombo', 75, true],
    ['colombo-fort', 'Demo Colombo Fort Apartment', 'apartment', 'colombo', 60, false],
    ['kandy-lake', 'Demo Kandy Lake Resort', 'resort', 'kandy', 90, false],
    ['nuwara-cabin', 'Demo Nuwara Eliya Hill Cabin', 'cabin', 'nuwara eliya', 45, false],
  ];
  data.hotels = hotels.map(([key, name, type, city, cheapestPrice, featured], index) => ({
    _id: id('hotel:' + key), name, type, city, address: `${10 + index} Demo Lane, ${city}`,
    distance: `${index % 3 + 1} km from city centre`, photos: [photos[index % photos.length], photos[(index + 1) % photos.length]],
    desc: `Demo ${type} in ${city} with comfortable rooms, complimentary Wi-Fi and easy access to local sights. This is sample listing data.`,
    rating: (4 + index % 5 / 10).toFixed(1), rooms: makeRooms('hotel:' + key, cheapestPrice), cheapestPrice, featured,
  }));

  data.farms = [
    ['kandy-organic', 'Demo Kandy Organic Farm', 'organic farm', 'kandy', 40],
    ['nuwara-tea', 'Demo Nuwara Eliya Tea Farm', 'tea farm', 'nuwara eliya', 50],
    ['galle-coconut', 'Demo Galle Coconut Farm', 'coconut farm', 'galle', 35],
  ].map(([key, name, type, city, cheapestPrice], index) => ({
    _id: id('farm:' + key), name, type, city, address: `${20 + index} Demo Farm Road, ${city}`,
    distance: [`${index + 2} km from town`, 'Walking distance to nature trails'], photos: photos[index],
    desc: 'Sample countryside farm stay with guided farm walks, home-cooked meals and private guest rooms.',
    rating: '4.5', rooms: makeRooms('farm:' + key, cheapestPrice), cheapestPrice, featured: index === 0,
  }));
  return data;
}

export async function seedDatabase({ dryRun = false, password = DEMO_PASSWORD } = {}) {
  if (typeof password !== 'string' || password.length < 8) throw new Error('Use a demo password of at least 8 characters.');
  const data = buildSeedData(await bcrypt.hash(password, 10));
  // Validate every schema before any database writes.
  for (const [key, records] of Object.entries(data)) {
    for (const record of records) await new models[key](record).validate();
  }
  if (dryRun) return Object.fromEntries(Object.entries(data).map(([key, records]) => [key, { planned: records.length }]));

  // Never overwrite or promote an existing account with a matching identity.
  const identities = await User.find({ $or: [{ username: { $in: data.users.map(user => user.username) } }, { email: { $in: data.users.map(user => user.email) } }] }).select('_id username email').lean();
  const users = data.users.filter(user => !identities.some(existing => existing._id.toString() !== user._id.toString() && (existing.username === user.username || existing.email === user.email)));
  const skippedUsers = data.users.length - users.length;
  data.users = users;

  const summary = {};
  for (const key of ['users', 'rooms', 'hotels', 'farms']) {
    if (!data[key].length) {
      summary[key] = { inserted: 0, existing: 0 };
      continue;
    }
    const result = await models[key].bulkWrite(data[key].map(record => ({ updateOne: {
      filter: { _id: record._id }, update: { $setOnInsert: record }, upsert: true, timestamps: false,
    } })), { ordered: true });
    summary[key] = { inserted: result.upsertedCount, existing: result.matchedCount };
  }
  summary.users.skippedIdentityConflicts = skippedUsers;
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--dry-run')) throw new Error('Usage: npm run seed [-- --dry-run]');
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
  const dryRun = args.includes('--dry-run');
  try {
    if (!dryRun) {
      if (!process.env.MONGO) throw new Error('Configure MONGO in api/.env first.');
      try { await mongoose.connect(process.env.MONGO, { serverSelectionTimeoutMS: 10000 }); }
      catch { throw new Error('Unable to connect to the configured database.'); }
    }
    console.log(JSON.stringify(await seedDatabase({ dryRun, password: process.env.SEED_DEMO_PASSWORD || DEMO_PASSWORD }), null, 2));
  } finally { await mongoose.disconnect(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error.name === 'ValidationError' ? 'Sample data failed schema validation.'
      : error.name === 'Error' ? error.message : 'Seeding failed. Existing records were not overwritten; rerun to finish missing inserts.');
    process.exitCode = 1;
  });
}

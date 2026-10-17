import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';
import Farm from '../models/Farm.js';
import { buildSeedData, seedDatabase, DEMO_PASSWORD } from '../scripts/seed.js';

test('sample data validates against all models and has complete, unique room references', async () => {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 4);
  const data = buildSeedData(hash, new Date('2026-10-17T00:00:00Z'));
  assert.deepEqual(Object.fromEntries(Object.entries(data).map(([key, docs]) => [key, docs.length])), { users: 8, rooms: 26, hotels: 10, farms: 3 });
  const models = { users: User, hotels: Hotel, rooms: Room, farms: Farm };
  for (const [key, docs] of Object.entries(data)) {
    for (const doc of docs) await new models[key](doc).validate();
  }
  assert.ok(data.users.every(user => !user.isAdmin && user.email.endsWith('@example.test')));
  assert.ok(await bcrypt.compare(DEMO_PASSWORD, data.users[0].password));
  const ids = Object.values(data).flat().map(doc => doc._id.toString());
  assert.equal(new Set(ids).size, ids.length);
  const links = [...data.hotels, ...data.farms].flatMap(property => property.rooms);
  assert.deepEqual([...links].sort(), data.rooms.map(room => room._id.toString()).sort());
  const numberIds = data.rooms.flatMap(room => room.roomNumbers.map(number => number._id.toString()));
  assert.equal(new Set(numberIds).size, 78);
  assert.ok(data.rooms.every(room => room.roomNumbers.some(number => number.unavailableDates.length === 0)));
  assert.deepEqual(new Set(data.hotels.map(hotel => hotel.type)), new Set(['hotel', 'apartment', 'resort', 'villa', 'cabin']));
  assert.equal(data.hotels.filter(hotel => hotel.featured).length, 4);
  for (const city of ['chennai', 'london', 'banglore']) assert.ok(data.hotels.some(hotel => hotel.city === city));
  for (const property of [...data.hotels, ...data.farms]) {
    assert.equal(property.cheapestPrice, Math.min(...data.rooms.filter(room => property.rooms.includes(room._id.toString())).map(room => room.price)));
  }
  const rerun = buildSeedData(hash, new Date('2026-11-01T00:00:00Z'));
  assert.deepEqual(Object.values(rerun).flat().map(doc => doc._id.toString()), ids);
});

test('dry-run validates the plan without database access', async () => {
  const plan = await seedDatabase({ dryRun: true });
  assert.equal(plan.hotels.planned, 10);
  assert.equal(plan.rooms.planned, 26);
});

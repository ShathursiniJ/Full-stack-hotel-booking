import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { bootstrapAdmin } from '../scripts/bootstrap-admin.js';

test('first-admin bootstrap hashes credentials and refuses existing accounts', async () => {
  const originalExists = User.exists;
  const originalSave = User.prototype.save;
  const fields = { username: 'fixture-admin', email: 'fixture@example.test', password: 'fixture-only-password', country: 'Sri Lanka', city: 'Colombo', phone: '0771234567' };
  let saved;
  let adminExists = false;
  let accountExists = false;
  User.exists = async query => query.isAdmin ? adminExists : accountExists;
  User.prototype.save = async function () { await this.validate(); saved = this; return this; };
  try {
    await bootstrapAdmin(fields);
    assert.equal(saved.username, fields.username);
    assert.equal(saved.isAdmin, true);
    assert.notEqual(saved.password, fields.password);
    assert.equal(await bcrypt.compare(fields.password, saved.password), true);
    saved = undefined;
    adminExists = true;
    await assert.rejects(bootstrapAdmin(fields), /administrator already exists/);
    assert.equal(saved, undefined);
    adminExists = false;
    accountExists = true;
    await assert.rejects(bootstrapAdmin(fields), /username or email already exists/);
    assert.equal(saved, undefined);
    accountExists = false;
    for (const override of [{ password: '' }, { email: 'invalid' }, { country: '' }, { phone: 'not-a-number' }]) {
      await assert.rejects(bootstrapAdmin({ ...fields, ...override }));
      assert.equal(saved, undefined);
    }
  } finally {
    User.exists = originalExists;
    User.prototype.save = originalSave;
  }
});

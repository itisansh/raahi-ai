// Disposable compatibility spike. Never reads project credentials or existing DBs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { hashPassword } from 'better-auth/crypto';
import { bearer, emailOTP, twoFactor, oneTimeToken } from 'better-auth/plugins';

assert.equal(JSON.parse(readFileSync(new URL('./node_modules/better-auth/package.json', import.meta.url))).version, '1.6.23');
const passed = [];
const pass = name => { passed.push(name); console.log(`PASS: ${name}`); };
let replica;
let connection;
try {
  replica = await MongoMemoryReplSet.create({ binary: { version: '8.2.1' },
    replSet: { count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' } });
  connection = await mongoose.createConnection(replica.getUri(), {
    dbName: 'raahi_m0_disposable', serverSelectionTimeoutMS: 10000,
  }).asPromise();
  const db = connection.db;
  const client = connection.getClient();
  assert((await db.admin().command({ hello: 1 })).setName);
  pass('real local replica set and Mongoose connection');

  // Auth owns these collections; business Mongoose models do not write them.
  for (const name of ['user', 'account', 'session', 'verification', 'twoFactor']) await db.createCollection(name);
  await db.collection('user').createIndex({ email: 1 }, { unique: true });
  await db.collection('account').createIndex({ accountId: 1, providerId: 1 }, { unique: true });
  await db.collection('session').createIndex({ token: 1 }, { unique: true });
  const now = new Date();
  const userId = 'legacy-user-non-object-id';
  const password = randomUUID() + '-Aa9!';
  // Synthetic source-shaped rows: preserve hashes/IDs, rename only id -> _id.
  const passwordHash = await hashPassword(password);
  const importedToken = randomUUID();
  await db.collection('user').insertOne({ _id: userId, name: 'Imported fixture',
    email: 'imported@example.test', emailVerified: true, defaultCurrency: 'INR',
    twoFactorEnabled: false, createdAt: now, updatedAt: now });
  await db.collection('account').insertOne({ _id: 'legacy-account', userId,
    accountId: userId, providerId: 'credential', password: passwordHash,
    createdAt: now, updatedAt: now });
  await db.collection('session').insertOne({ _id: 'legacy-session', userId,
    token: importedToken, expiresAt: new Date(Date.now() + 3600000), createdAt: now, updatedAt: now });
  const otpMessages = [];
  const auth = betterAuth({ baseURL: 'http://localhost:8780', basePath: '/api/auth',
    secret: randomUUID() + randomUUID(), trustedOrigins: ['http://localhost:8780'],
    database: mongodbAdapter(db, { client }),
    advanced: { database: { generateId: () => randomUUID() } },
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: { sendOnSignUp: true, sendOnSignIn: true, autoSignInAfterVerification: true },
    user: { additionalFields: { defaultCurrency: { type: 'string', defaultValue: 'INR', input: true } } },
    plugins: [bearer(), oneTimeToken({ expiresIn: 3, disableClientRequest: true, storeToken: 'hashed' }),
      twoFactor({ issuer: 'Raahi AI', allowPasswordless: true }),
      emailOTP({ overrideDefaultEmailVerification: true, storeOTP: 'hashed',
        sendVerificationOTP: async data => { otpMessages.push(data); } })],
  });
  const request = async (path, body, headers = {}) => {
    const response = await auth.handler(new Request(`http://localhost:8780/api/auth${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { origin: 'http://localhost:8780', 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }));
    return { response, data: await response.json() };
  };
  const login = await request('/sign-in/email', { email: 'imported@example.test', password });
  assert.equal(login.response.status, 200);
  assert.equal(login.data.user.id, userId);
  assert.equal(login.data.user.defaultCurrency, 'INR');
  assert.equal((await db.collection('account').findOne({ _id: 'legacy-account' })).password, passwordHash);
  const cookie = login.response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  assert(cookie);
  assert.equal((await request('/get-session', undefined, { cookie })).data.user.id, userId);
  pass('imported string user/account IDs, unchanged password hash, cookie login');
  assert.equal((await request('/get-session', undefined, { authorization: `Bearer ${importedToken}` })).data.user.id, userId);
  pass('imported session token and bearer continuity');
  assert.equal((await request('/sign-in/email', { email: 'imported@example.test', password: 'incorrect-password' })).response.status, 401);
  pass('incorrect password rejected');
  const signup = await request('/sign-up/email', { name: 'New fixture', email: 'new@example.test', password });
  assert.equal(signup.response.status, 200);
  const otp = otpMessages.find(m => m.email === 'new@example.test');
  assert(otp);
  const unverified = await request('/sign-in/email', { email: 'new@example.test', password });
  assert.equal(unverified.response.status, 403);
  const latestOtp = otpMessages.filter(m => m.email === 'new@example.test').at(-1);
  const verified = await request('/email-otp/verify-email', { email: 'new@example.test', otp: latestOtp.otp });
  assert.equal(verified.response.status, 200);
  const newUser = await db.collection('user').findOne({ email: 'new@example.test' });
  assert.equal(typeof newUser._id, 'string');
  assert(newUser.emailVerified);
  pass('new string-ID registration, OTP verification and unverified-login rejection');
  await request('/sign-out', {}, { cookie });
  assert.equal((await request('/get-session', undefined, { cookie })).data, null);
  pass('session revocation');

  const context = await auth.$context;
  await assert.rejects(context.adapter.transaction(async adapter => {
    await adapter.create({ model: 'user', data: { name: 'Rollback', email: 'rollback@example.test',
      emailVerified: true, createdAt: now, updatedAt: now } });
    throw new Error('deliberate auth rollback');
  }), /deliberate auth rollback/);
  assert.equal(await db.collection('user').countDocuments({ email: 'rollback@example.test' }), 0);
  pass('pinned Better Auth adapter transaction rollback with Mongoose-owned native client');

  const Trip = connection.model('M0Trip', new mongoose.Schema({ _id: String,
    ownerId: { type: String, required: true }, revision: { type: Number, required: true } },
  { collection: 'm0_trips', versionKey: false }));
  const Expense = connection.model('M0Expense', new mongoose.Schema({ _id: String,
    tripId: String, requestId: String, amountMinor: { type: Number, validate: Number.isSafeInteger } },
  { collection: 'm0_expenses', versionKey: false }));
  Expense.schema.index({ tripId: 1, requestId: 1 }, { unique: true });
  await Trip.init(); await Expense.init();
  await Trip.create({ _id: 'trip-string-id', ownerId: userId, revision: 0 });
  await assert.rejects(connection.transaction(async session => {
    await Trip.updateOne({ _id: 'trip-string-id', revision: 0 }, { $inc: { revision: 1 } }, { session });
    await Expense.create([{ _id: 'rollback-expense', tripId: 'trip-string-id', requestId: 'rollback', amountMinor: 10001 }], { session });
    throw new Error('deliberate business rollback');
  }), /deliberate business rollback/);
  assert.equal((await Trip.findById('trip-string-id')).revision, 0);
  assert.equal(await Expense.countDocuments(), 0);
  pass('multi-collection rollback preserves trip revision and expense ledger');
  const write = id => connection.transaction(async session => {
    const result = await Trip.updateOne({ _id: 'trip-string-id', revision: 0 }, { $inc: { revision: 1 } }, { session });
    if (result.modifiedCount !== 1) throw new Error('stale revision');
    await Expense.create([{ _id: id, tripId: 'trip-string-id', requestId: id, amountMinor: 10001 }], { session });
  });
  const results = await Promise.allSettled([write('a'), write('b')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.message, 'stale revision');
  assert.equal(await Expense.countDocuments(), 1);
  assert.equal((await Trip.findById('trip-string-id')).revision, 1);
  const expense = await Expense.findOne().lean();
  await assert.rejects(Expense.create({ ...expense, _id: 'duplicate' }), { code: 11000 });
  assert.equal(expense.amountMinor, 10001);
  assert.equal((await Trip.findById('trip-string-id')).ownerId, userId);
  pass('one winning concurrent revision, unique retry key, exact integer money and auth reference');
  console.log(`PASS: ${passed.length} compatibility checks; synthetic fixtures only`);
} finally {
  if (connection) await connection.close();
  if (replica) await replica.stop();
}

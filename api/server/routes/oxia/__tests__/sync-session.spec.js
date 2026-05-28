const express = require('express');
const request = require('supertest');

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  decode: jest.fn(),
}));

jest.mock('jwks-rsa', () => {
  return jest.fn(() => ({
    getSigningKey: jest.fn((_kid, cb) => cb(null, { getPublicKey: () => 'mock-public-key' })),
  }));
});

jest.mock('~/models', () => ({
  findUser: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  getUserById: jest.fn(),
}));

jest.mock('~/server/services/AuthService', () => ({
  setAuthTokens: jest.fn(),
}));

describe('POST /api/oxia/sync-session', () => {
  let app;
  let syncSessionRouter;
  const jwt = require('jsonwebtoken');
  const { findUser, createUser, getUserById } = require('~/models');
  const { setAuthTokens } = require('~/server/services/AuthService');

  beforeAll(() => {
    process.env.OXIA_GATEWAY_JWKS_URI = 'https://gateway.example/.well-known/jwks.json';
    process.env.OXIA_GATEWAY_JWT_ISSUER = 'https://gateway.example';
    process.env.OXIA_GATEWAY_JWT_AUDIENCE = 'librechat';
    syncSessionRouter = require('../sync-session');
    app = express();
    app.use(express.json());
    app.use('/api/oxia', syncSessionRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 when request body has no gatewayJwt', async () => {
    const response = await request(app).post('/api/oxia/sync-session').send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({ message: expect.stringMatching(/gatewayJwt/i) }),
    );
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  test('returns 401 when JWT verification rejects', async () => {
    jwt.verify.mockImplementation((_token, _getKey, _opts, cb) => {
      cb(new Error('invalid signature'), null);
    });

    const response = await request(app)
      .post('/api/oxia/sync-session')
      .send({ gatewayJwt: 'bad.jwt.token' });

    expect(response.status).toBe(401);
    expect(findUser).not.toHaveBeenCalled();
    expect(setAuthTokens).not.toHaveBeenCalled();
  });

  test('returns 200 and mints session when JWT verifies; upserts user with payload.sub', async () => {
    const payload = {
      sub: 'oxia-user-abc123',
      email: 'oxia-user@example.com',
      name: 'Oxia User',
    };
    jwt.verify.mockImplementation((_token, _getKey, _opts, cb) => {
      cb(null, payload);
    });

    findUser.mockResolvedValueOnce(null);
    const fakeMongoId = { toString: () => 'mongo-id-42' };
    createUser.mockResolvedValueOnce(fakeMongoId);
    getUserById.mockResolvedValueOnce({
      _id: fakeMongoId,
      oxiaUserId: 'oxia-user-abc123',
      email: 'oxia-user@example.com',
      name: 'Oxia User',
    });
    setAuthTokens.mockImplementation(async (_userId, res) => {
      res.cookie('refreshToken', 'mock-refresh', { httpOnly: true });
      return 'mock-access-token';
    });

    const response = await request(app)
      .post('/api/oxia/sync-session')
      .send({ gatewayJwt: 'good.jwt.token' });

    expect(response.status).toBe(200);
    expect(jwt.verify).toHaveBeenCalledTimes(1);

    expect(findUser).toHaveBeenCalledWith(
      expect.objectContaining({ oxiaUserId: 'oxia-user-abc123' }),
    );
    expect(createUser).toHaveBeenCalledTimes(1);
    const createCallArgs = createUser.mock.calls[0];
    expect(createCallArgs[0]).toEqual(
      expect.objectContaining({
        oxiaUserId: 'oxia-user-abc123',
        email: 'oxia-user@example.com',
      }),
    );

    expect(setAuthTokens).toHaveBeenCalledTimes(1);
    // setAuthTokens receives (userId, res) — userId comes from getUserById
    // returning the upserted user document with _id.
    expect(setAuthTokens.mock.calls[0][0]).toBeDefined();

    expect(response.body).toEqual(
      expect.objectContaining({
        token: 'mock-access-token',
        user: expect.objectContaining({ oxiaUserId: 'oxia-user-abc123' }),
      }),
    );
    const setCookie = response.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(setCookie.join(';')).toMatch(/refreshToken=mock-refresh/);
  });
});

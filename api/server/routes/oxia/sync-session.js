const express = require('express');
// Use `jose` rather than `jsonwebtoken` here because the gateway signs
// OPAQUE JWTs with Ed25519 (EdDSA) — see crates/oxia-mode-2-auth/src/jwt.rs
// and the gateway's JWKS `alg: EdDSA`. The `jsonwebtoken` v9 we ship for
// LC's own auth supports only RS*/ES*/HS*, so it can't validate EdDSA.
// `jose` covers it and ships first-party JWKS support too.
const { jwtVerify, createRemoteJWKSet } = require('jose');
const { logger } = require('@librechat/data-schemas');
const { findUser, createUser, updateUser, getUserById } = require('~/models');
const { setAuthTokens } = require('~/server/services/AuthService');

/**
 * Mode-2 session-sync endpoint.
 *
 * Accepts a JWT minted by the Oxia gateway, validates the signature against
 * the gateway's JWKS, upserts a local LibreChat user keyed off the JWT's
 * `sub` claim, and mints a LibreChat session cookie via the existing
 * AuthService helper. The Mode-2 SDK calls this on the client side
 * immediately after the gateway handshake completes, so that LibreChat's
 * existing JWT-cookie based auth keeps working for every other route on
 * the server.
 *
 * The endpoint relies on the same `setAuthTokens` helper that the
 * password-login controller uses, so the cookie shape is byte-identical
 * to a normal login. No new way to mint sessions is introduced.
 *
 * Environment:
 *   OXIA_GATEWAY_JWKS_URI       — fetch URL for the gateway's JWKS
 *   OXIA_GATEWAY_JWT_ISSUER     — expected `iss` claim
 *   OXIA_GATEWAY_JWT_AUDIENCE   — expected `aud` claim
 */

const router = express.Router();

let _jwksInstance = null;
const getJwks = () => {
  if (_jwksInstance) {
    return _jwksInstance;
  }
  const jwksUri = process.env.OXIA_GATEWAY_JWKS_URI;
  if (!jwksUri) {
    return null;
  }
  // jose's remote JWKS handles fetching + caching + key rotation. Cache
  // settings default to 30s minimum + 10min cooldown which matches our
  // earlier jwks-rsa config closely enough.
  _jwksInstance = createRemoteJWKSet(new URL(jwksUri));
  return _jwksInstance;
};

const verifyGatewayJwt = async (token) => {
  const jwks = getJwks();
  if (!jwks) {
    throw new Error('OXIA_GATEWAY_JWKS_URI is not configured');
  }
  const { payload } = await jwtVerify(token, jwks, {
    issuer: process.env.OXIA_GATEWAY_JWT_ISSUER,
    audience: process.env.OXIA_GATEWAY_JWT_AUDIENCE,
    // jose infers the alg from the token header + JWKS; we don't pin
    // here because the JWKS already advertises `alg: EdDSA` and jose
    // refuses unsigned/unsafe algs by default.
  });
  return payload;
};

const upsertUserFromPayload = async (payload) => {
  const oxiaUserId = payload.sub;
  const existing = await findUser({ oxiaUserId });
  if (existing) {
    return existing;
  }

  // The Oxia gateway JWT only carries `sub` (the OPAQUE user_id) — no
  // email / name / preferred_username claims. In Mode 2 the user_id is
  // whatever the user typed in the email field on register (the
  // Registration override maps `email → userId`), so we use it for both
  // LC's required `email` and `username` columns. Falling back to `name`
  // = sub keeps LC's profile UI from rendering a blank.
  const userId = await createUser(
    {
      oxiaUserId,
      email: payload.email || oxiaUserId,
      name: payload.name || oxiaUserId,
      username: payload.preferred_username || payload.email || oxiaUserId,
      emailVerified: true,
      provider: 'oxia',
    },
    undefined,
    true,
    false,
  );

  const created = await getUserById(
    typeof userId?.toString === 'function' ? userId.toString() : userId,
  );
  return created;
};

router.post('/sync-session', async (req, res) => {
  const { gatewayJwt } = req.body ?? {};
  if (!gatewayJwt || typeof gatewayJwt !== 'string') {
    return res.status(400).json({ message: 'gatewayJwt is required' });
  }

  let payload;
  try {
    payload = await verifyGatewayJwt(gatewayJwt);
  } catch (err) {
    logger.warn('[sync-session] gateway JWT verification failed', err);
    return res.status(401).json({ message: 'gateway JWT verification failed' });
  }

  if (!payload || typeof payload.sub !== 'string' || payload.sub.length === 0) {
    return res.status(401).json({ message: 'gateway JWT missing sub claim' });
  }

  let user;
  try {
    user = await upsertUserFromPayload(payload);
  } catch (err) {
    logger.error('[sync-session] failed to upsert local user', err);
    return res.status(500).json({ message: 'failed to upsert local user' });
  }

  try {
    const userId = user?._id ?? user?.id;
    const token = await setAuthTokens(userId, res);
    const { password: _p, totpSecret: _t, __v, ...safeUser } = user ?? {};
    if (safeUser && typeof safeUser === 'object' && safeUser._id != null) {
      safeUser.id =
        typeof safeUser._id?.toString === 'function' ? safeUser._id.toString() : safeUser._id;
    }
    return res.status(200).json({ token, user: safeUser });
  } catch (err) {
    logger.error('[sync-session] failed to mint LibreChat session', err);
    return res.status(500).json({ message: 'failed to mint LibreChat session' });
  }
});

module.exports = router;

// Exposed for tests — keeps the cached JWKS client from leaking between runs.
module.exports._resetForTests = () => {
  _jwksClientInstance = null;
};
// Mark `updateUser` as intentionally available for downstream extension;
// kept in the import surface so future profile-update branches don't have to
// re-edit the requires.
void updateUser;

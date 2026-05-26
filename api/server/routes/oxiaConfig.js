// Split-11 §2 — mode switch endpoint the client uses to discover
// whether to render Mode 1 (default LibreChat) or Mode 2 (Oxia SDK)
// UI. Lives under `/api/oxia/config` to avoid clashing with the
// pre-existing `/api/config` route LibreChat ships.

const express = require('express');

const router = express.Router();

router.get('/config', (req, res) => {
  const mode = process.env.OXIA_MODE === '2' ? 2 : 1;
  const gatewayUrl = process.env.OXIA_GATEWAY_URL || 'http://localhost:8080';

  res.json({
    oxiaMode: mode,
    // null under Mode 1 — the client must never call into the SDK
    // when the server hasn't been switched into Mode 2.
    gatewayUrl: mode === 2 ? gatewayUrl : null,
  });
});

module.exports = router;

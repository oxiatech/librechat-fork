// Defense-in-depth: routes guarded by this middleware return 410
// Gone when the server runs in Mode 2. Layered on top of the
// conditional route mount in index.js so that even if a future PR
// accidentally drops the conditional, sensitive Mode-1 endpoints
// (OAuth, password auth, etc.) stay disabled.

module.exports = function requireMode1(req, res, next) {
  if (process.env.OXIA_MODE === '2') {
    return res.status(410).json({
      error: 'gone',
      message: 'This endpoint is not available in Mode 2.',
    });
  }
  return next();
};

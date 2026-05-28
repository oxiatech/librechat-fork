// Defense-in-depth: routes guarded by this middleware return 410
// Gone when the server runs in Mode 2. Layered on top of the
// conditional route mount in index.js so that even if a future PR
// accidentally drops the conditional, sensitive Mode-1 endpoints
// (OAuth, password auth, etc.) stay disabled.
//
// Exception: a small allowlist of subpaths stays open under Mode 2
// because the LC session cookie minted by `/api/oxia/sync-session`
// participates in LC's normal session lifecycle. Specifically:
//   - /refresh and /refresh/:any  — LC's frontend auto-refreshes on
//                                    every navigation; 410 here would
//                                    bounce the user to /login.
//   - /logout                     — needed for sign-out to clear cookies.
//   - /user                       — current-user query LC uses for
//                                    bootstrap state.
// The blocked endpoints (login / register / password-reset / verify)
// stay 410 because under Mode 2 there's no LC-side password to check
// against — those requests can't succeed and are pure attack surface.

const MODE2_OPEN_PREFIXES = ['/refresh', '/logout', '/user'];

module.exports = function requireMode1(req, res, next) {
  if (process.env.OXIA_MODE !== '2') {
    return next();
  }
  const subpath = req.path || '/';
  const open = MODE2_OPEN_PREFIXES.some(
    (p) => subpath === p || subpath.startsWith(p + '/'),
  );
  if (open) {
    return next();
  }
  return res.status(410).json({
    error: 'gone',
    message: 'This endpoint is not available in Mode 2.',
  });
};

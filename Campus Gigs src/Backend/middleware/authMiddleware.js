// =============================================================================
// middleware/authMiddleware.js
// -----------------------------------------------------------------------------
// Verifies the JWT sent in the Authorization header on every protected route.
//
// When a request passes this middleware, `req.user` is populated with the
// decoded JWT payload (at minimum: { id, email, role }).
//
// When a request fails (missing/expired/invalid token), the middleware
// immediately returns 401 Unauthorized and the route handler never executes.
//
// Usage in a route file:
//   const authMiddleware = require('../middleware/authMiddleware');
//   router.get('/protected', authMiddleware, handler);
//   router.use(authMiddleware); // applies to ALL routes in the file
// =============================================================================

const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  // -------------------------------------------------------------------------
  // Extract the token from the Authorization header.
  // Expected format: "Bearer <token>"
  // We split on the space and take index [1] to get just the token string.
  // -------------------------------------------------------------------------
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Access denied. No token provided.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // -------------------------------------------------------------------------
    // jwt.verify() does two things simultaneously:
    //   1. Checks the signature — ensures the token was signed by OUR secret
    //      and has not been tampered with.
    //   2. Checks the expiry — throws TokenExpiredError if exp is in the past.
    //
    // JWT_SECRET in .env must be a long, random string. Generate one with:
    //   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
    // -------------------------------------------------------------------------
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded payload to the request object so route handlers can
    // access the authenticated user's ID, email, and role without decoding again.
    req.user = decoded;

    next(); // Pass control to the next middleware or route handler
  } catch (err) {
    // -------------------------------------------------------------------------
    // Distinguish between the two main JWT error types for clearer logging.
    // Both return 401 to the client — we don't leak which condition failed.
    // -------------------------------------------------------------------------
    if (err.name === "TokenExpiredError") {
      console.warn("Auth middleware: expired token attempt.");
      return res.status(401).json({
        message: "Session expired. Please log in again.",
      });
    }

    console.warn("Auth middleware: invalid token attempt.", err.message);
    return res.status(401).json({
      message: "Invalid token. Please log in again.",
    });
  }
};

module.exports = authMiddleware;

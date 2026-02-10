const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { User } = require("../models");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

async function createUser(username, password, email) {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  const user = await User.create({ username, email, passwordHash: hash });
  return user;
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// Express middleware: accepts x-api-key header OR Bearer token
// Extracts user info including id, username, role, and locations into req.user
function authMiddleware(req, res, next) {
  const apiKey = process.env.API_KEY || "secret-key";
  const headerKey = req.header("x-api-key");
  if (headerKey && headerKey === apiKey) {
    req.user = { type: "api_key" };
    return next();
  }

  const auth = req.header("authorization");
  if (!auth) return res.status(401).json({ error: "Missing auth" });
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer")
    return res.status(401).json({ error: "Invalid auth format" });
  const token = parts[1];
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid token" });
  // Attach all user fields from token to req.user
  req.user = {
    id: payload.id,
    username: payload.username,
    role: payload.role || 'USER',
    locations: payload.locations || []
  };
  next();
}

module.exports = {
  createUser,
  verifyPassword,
  signToken,
  verifyToken,
  authMiddleware,
};

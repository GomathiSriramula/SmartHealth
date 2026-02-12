const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { User } = require("../models");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

async function createUser(username, password, email, options = {}) {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  
  const userObj = {
    username,
    email,
    passwordHash: hash
  };
  
  // Add role if provided (otherwise schema default applies)
  if (options.role) {
    userObj.role = options.role;
  }
  
  // Add adminLocation only for ADMIN role
  if (options.role === 'ADMIN' && options.adminLocation) {
    userObj.adminLocation = options.adminLocation;
  }
  
  const user = await User.create(userObj);
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
// Extracts user info (id, username, role) from token and fetches adminLocation from database if ADMIN
// Attaches to req.user with location-based authorization support
async function authMiddleware(req, res, next) {
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
  
  try {
    // Fetch user from database to get complete profile including adminLocation
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: "User not found" });
    
    // Attach core user info to req.user (always present)
    req.user = {
      id: user._id.toString(),
      username: user.username,
      role: user.role || 'USER',
      locations: user.locations || []
    };
    
    // If user is ADMIN role, validate and attach adminLocation
    if (req.user.role === 'ADMIN') {
      if (!user.adminLocation || !user.adminLocation.state || !user.adminLocation.district || !user.adminLocation.village) {
        return res.status(500).json({
          error: "Admin location not configured",
          detail: "Admin user is missing complete location assignment (state, district, village)"
        });
      }
      req.user.adminLocation = {
        state: user.adminLocation.state,
        district: user.adminLocation.district,
        village: user.adminLocation.village
      };
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(500).json({ error: "Authentication failed", detail: error.message });
  }
}

module.exports = {
  createUser,
  verifyPassword,
  signToken,
  verifyToken,
  authMiddleware,
};

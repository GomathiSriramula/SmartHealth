const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { User } = require("../models");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const DEFAULT_ADMIN_EMAIL = "admin@health.in";
const DEFAULT_ADMIN_PASSWORD = "Admin@123";
const DEFAULT_ADMIN_USERNAME = "telangana-admin";

function normalizeLocation(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getUserDistrict(user) {
  if (!user || user.role !== "OPERATOR") {
    return "";
  }

  const district = user.locations?.[0];
  return typeof district === "string" ? district.trim() : "";
}

function buildDistrictFilter(user, fieldName = "location") {
  const district = getUserDistrict(user);
  if (!district) {
    return {};
  }

  return {
    [fieldName]: new RegExp(`^${district.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  };
}

function getRequestLocation(req, options = {}) {
  if (typeof options.getLocation === "function") {
    return options.getLocation(req);
  }

  return (
    req.body?.location ||
    req.body?.district ||
    req.body?.village ||
    req.query?.location ||
    req.params?.location ||
    ""
  );
}

function operatorMatchesDistrict(user, location) {
  const district = getUserDistrict(user);
  return Boolean(district) && normalizeLocation(district) === normalizeLocation(location);
}

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
  
  if (Array.isArray(options.locations) && options.locations.length > 0) {
    userObj.locations = options.locations;
  }

  // Add adminLocation only when provided for ADMIN role
  if (options.role === 'ADMIN' && options.adminLocation) {
    userObj.adminLocation = options.adminLocation;
  }
  
  const user = await User.create(userObj);
  return user;
}

async function ensureDefaultAdmin() {
  const existingAdmin = await User.findOne({ email: DEFAULT_ADMIN_EMAIL });
  if (existingAdmin) {
    return existingAdmin;
  }

  return createUser(DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_EMAIL, {
    role: 'ADMIN',
    adminLocation: {
      state: 'Telangana'
    }
  });
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
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
// Extracts user info (id, username, role) from token and attaches any stored adminLocation metadata
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
    
    // If user is ADMIN role, attach any stored adminLocation metadata
    if (req.user.role === 'ADMIN') {
      req.user.adminLocation = user.adminLocation || null;
    }
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(500).json({ error: "Authentication failed", detail: error.message });
  }
}

module.exports = {
  createUser,
  ensureDefaultAdmin,
  buildDistrictFilter,
  hashPassword,
  getUserDistrict,
  verifyPassword,
  signToken,
  verifyToken,
  authMiddleware,
  requireRole,
  operatorMatchesDistrict,
};

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role || 'USER';

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Only ${allowedRoles.join(', ')} can perform this action`
      });
    }

    next();
  };
}

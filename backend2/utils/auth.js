const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { User } = require("../models");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Add a strong random value to your .env (openssl rand -hex 32)."
  );
}

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

  if (options.role) {
    userObj.role = options.role;
  }

  if (Array.isArray(options.locations) && options.locations.length > 0) {
    userObj.locations = options.locations;
  }

  if (options.role === 'ADMIN' && options.adminLocation) {
    userObj.adminLocation = options.adminLocation;
  }

  const user = await User.create(userObj);
  return user;
}

// Builds the list of admin accounts to bootstrap on startup. No credentials
// are hardcoded — this is intentionally a no-op unless you opt in via .env.
//
// Two ways to configure it:
//   1. DEFAULT_ADMINS — a JSON array in .env, for multiple startup admins:
//        DEFAULT_ADMINS=[{"email":"a@x.com","password":"...","username":"admin1","state":"Telangana"},{"email":"b@x.com","password":"...","username":"admin2"}]
//   2. DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD / DEFAULT_ADMIN_USERNAME /
//      DEFAULT_ADMIN_STATE — the legacy single-admin vars. Still supported so
//      existing .env files keep working, and treated as one extra entry.
//
// Both can be set at once — entries are merged (by email) with DEFAULT_ADMINS
// taking priority on a collision.
function getDefaultAdminConfigs() {
  const configs = new Map(); // keyed by email, de-duplicates + lets legacy vars fill gaps

  const rawList = process.env.DEFAULT_ADMINS;
  if (rawList) {
    let parsed;
    try {
      parsed = JSON.parse(rawList);
    } catch (e) {
      console.error(`❌ DEFAULT_ADMINS is not valid JSON, ignoring it: ${e.message}`);
      parsed = [];
    }
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry && entry.email && entry.password) {
          configs.set(entry.email, {
            email: entry.email,
            password: entry.password,
            username: entry.username || entry.email.split('@')[0],
            state: entry.state || "",
          });
        } else {
          console.warn('⚠️  Skipping DEFAULT_ADMINS entry missing email/password:', entry);
        }
      }
    } else {
      console.error('❌ DEFAULT_ADMINS must be a JSON array, ignoring it.');
    }
  }

  const legacyEmail = process.env.DEFAULT_ADMIN_EMAIL;
  const legacyPassword = process.env.DEFAULT_ADMIN_PASSWORD;
  if (legacyEmail && legacyPassword && !configs.has(legacyEmail)) {
    configs.set(legacyEmail, {
      email: legacyEmail,
      password: legacyPassword,
      username: process.env.DEFAULT_ADMIN_USERNAME || "admin",
      state: process.env.DEFAULT_ADMIN_STATE || "",
    });
  }

  return Array.from(configs.values());
}

async function ensureDefaultAdmin() {
  const configs = getDefaultAdminConfigs();
  if (configs.length === 0) {
    return [];
  }

  const admins = [];
  for (const config of configs) {
    const existingAdmin = await User.findOne({ email: config.email });
    if (existingAdmin) {
      admins.push(existingAdmin);
      continue;
    }

    const newAdmin = await createUser(config.username, config.password, config.email, {
      role: 'ADMIN',
      adminLocation: { state: config.state },
    });
    console.log(`✅ Default admin created: ${config.email} — remove its credentials from .env now`);
    admins.push(newAdmin);
  }

  return admins;
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

async function authMiddleware(req, res, next) {
  const apiKey = process.env.API_KEY;
  const headerKey = req.header("x-api-key");
  const auth = req.header("authorization");

  if (!auth && apiKey && headerKey && headerKey === apiKey) {
    req.user = { type: "api_key" };
    return next();
  }

  if (!auth) return res.status(401).json({ error: "Missing auth" });
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer")
    return res.status(401).json({ error: "Invalid auth format" });
  const token = parts[1];
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Invalid token" });

  try {
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = {
      id: user._id.toString(),
      username: user.username,
      role: user.role || 'USER',
      locations: user.locations || []
    };

    if (req.user.role === 'ADMIN') {
      req.user.adminLocation = user.adminLocation || null;
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(500).json({ error: "Authentication failed" });
  }
}

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
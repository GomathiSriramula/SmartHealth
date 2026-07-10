const express = require("express");
const router = express.Router();
const { createUser, verifyPassword, signToken, authMiddleware, requireRole, hashPassword } = require("../utils/auth");
const { User } = require("../models");

function formatOperator(user) {
  return {
    id: user._id,
    name: user.username,
    email: user.email,
    state: 'Telangana',
    district: user.locations?.[0] || '',
    created_at: user.created_at || user.createdAt || null,
  };
}

// Register
router.post("/auth/register", async (req, res) => {
  try {
    const { username, password, email, role } = req.body;
    if (!username || !password || !email)
      return res.status(400).json({ error: "username, password, and email are required" });

    if (role && role !== 'USER') {
      return res.status(403).json({ error: "Public registration is restricted to USER accounts only" });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if username exists
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(409).json({ error: "username already exists" });
    
    // Check if email exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(409).json({ error: "email already exists" });
    
    const user = await createUser(username, password, email, {
      role: 'USER'
    });
    return res.json({ id: user._id, username: user.username, email: user.email, role: user.role });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "registration failed", detail: e.message });
  }
});

router.post("/auth/operators", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, username, password, email, district } = req.body;
    const operatorName = (name || username || '').trim();

    if (!operatorName || !password || !email || !district) {
      return res.status(400).json({
        error: "name, password, email, and district are required"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const existingUser = await User.findOne({ username: operatorName });
    if (existingUser) return res.status(409).json({ error: "username already exists" });

    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(409).json({ error: "email already exists" });

    const user = await createUser(operatorName, password, email, {
      role: 'OPERATOR',
      locations: [district.trim()]
    });

    return res.status(201).json({
      operator: formatOperator(user)
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "operator creation failed", detail: e.message });
  }
});

router.get("/auth/operators", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const operators = await User.find({ role: 'OPERATOR' }).sort({ created_at: -1 }).lean();
    return res.json({ operators: operators.map(formatOperator) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "failed to fetch operators", detail: e.message });
  }
});

router.put("/auth/operators/:id", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, username, password, email, district } = req.body;
    const operatorName = (name || username || '').trim();
    const operatorId = req.params.id;

    const operator = await User.findById(operatorId);
    if (!operator || operator.role !== 'OPERATOR') {
      return res.status(404).json({ error: "operator not found" });
    }

    if (!operatorName || !email || !district) {
      return res.status(400).json({ error: "name, email, and district are required" });
    }

    const existingName = await User.findOne({ username: operatorName, _id: { $ne: operatorId } });
    if (existingName) return res.status(409).json({ error: "name already exists" });

    const existingEmail = await User.findOne({ email, _id: { $ne: operatorId } });
    if (existingEmail) return res.status(409).json({ error: "email already exists" });

    operator.username = operatorName;
    operator.email = email;
    operator.locations = [district.trim()];

    if (password && password.trim()) {
      operator.passwordHash = await hashPassword(password.trim());
    }

    await operator.save();

    return res.json({ operator: formatOperator(operator) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "operator update failed", detail: e.message });
  }
});

router.delete("/auth/operators/:id", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const operator = await User.findById(req.params.id);
    if (!operator || operator.role !== 'OPERATOR') {
      return res.status(404).json({ error: "operator not found" });
    }

    await User.deleteOne({ _id: req.params.id });
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "operator delete failed", detail: e.message });
  }
});

// Login
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "invalid credentials" });
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });
    const token = signToken({
      id: user._id,
      username: user.username,
      role: user.role || 'USER',
      locations: user.locations || []
    });
    return res.json({ token, username: user.username, role: user.role || 'USER' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "login failed", detail: e.message });
  }
});

module.exports = router;

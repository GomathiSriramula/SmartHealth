const express = require("express");
const router = express.Router();
const { createUser, verifyPassword, signToken } = require("../utils/auth");
const { User } = require("../models");

// Register
router.post("/auth/register", async (req, res) => {
  try {
    const { username, password, email, role, state, district, village } = req.body;
    if (!username || !password || !email)
      return res.status(400).json({ error: "username, password, and email are required" });
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Validate and set role
    const userRole = role || 'USER';
    const validRoles = ['USER', 'ADMIN', 'OPERATOR'];
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ error: "Invalid role. Must be USER, ADMIN, or OPERATOR" });
    }

    // ADMIN-specific validation
    let normalizedState, normalizedDistrict, normalizedVillage;
    if (userRole === 'ADMIN') {
      if (!state || !district || !village) {
        return res.status(400).json({ error: "state, district, and village are required for ADMIN role" });
      }
      
      // Normalize admin location values (trim and lowercase for comparison)
      normalizedState = state.trim().toLowerCase();
      normalizedDistrict = district.trim().toLowerCase();
      normalizedVillage = village.trim().toLowerCase();
      
      if (!normalizedState || !normalizedDistrict || !normalizedVillage) {
        return res.status(400).json({ error: "state, district, and village cannot be empty or whitespace only" });
      }
    }
    
    // Check if username exists
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(409).json({ error: "username already exists" });
    
    // Check if email exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(409).json({ error: "email already exists" });
    
    // ADMIN-specific validation - prevent multiple admins for same village
    // CRITICAL: Only ONE admin allowed per unique village
    if (userRole === 'ADMIN') {
      // Escape special regex characters and create case-insensitive pattern
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      const existingAdmin = await User.findOne({
        role: 'ADMIN',
        'adminLocation.state': { $regex: new RegExp(`^${escapeRegex(normalizedState)}$`, 'i') },
        'adminLocation.district': { $regex: new RegExp(`^${escapeRegex(normalizedDistrict)}$`, 'i') },
        'adminLocation.village': { $regex: new RegExp(`^${escapeRegex(normalizedVillage)}$`, 'i') }
      });
      
      if (existingAdmin) {
        return res.status(409).json({ 
          error: "An admin already exists for this village",
          detail: `Village '${village.trim()}' in district '${district.trim()}', state '${state.trim()}' already has an assigned admin (${existingAdmin.username})`,
          existingAdmin: {
            username: existingAdmin.username,
            email: existingAdmin.email
          }
        });
      }
    }
    
    // Create user with optional role and adminLocation
    const userData = {
      username,
      password,
      email,
      role: userRole
    };

    // Add adminLocation only for ADMIN role (use original trimmed values for storage)
    if (userRole === 'ADMIN') {
      userData.adminLocation = { 
        state: state.trim(), 
        district: district.trim(), 
        village: village.trim() 
      };
    }

    const user = await createUser(userData.username, userData.password, userData.email, {
      role: userData.role,
      adminLocation: userData.adminLocation
    });
    return res.json({ id: user._id, username: user.username, email: user.email, role: user.role });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "registration failed", detail: e.message });
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
    return res.json({ token, username: user.username });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "login failed", detail: e.message });
  }
});

module.exports = router;

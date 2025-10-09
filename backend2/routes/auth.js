const express = require("express");
const router = express.Router();
const { createUser, verifyPassword, signToken } = require("../utils/auth");
const { User } = require("../models");

// Register
router.post("/auth/register", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password || !email)
      return res.status(400).json({ error: "username, password, and email are required" });
    
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
    
    const user = await createUser(username, password, email);
    return res.json({ id: user._id, username: user.username, email: user.email });
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
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "username and password required" });
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "invalid credentials" });
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });
    const token = signToken({ id: user._id, username: user.username });
    return res.json({ token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "login failed", detail: e.message });
  }
});

module.exports = router;

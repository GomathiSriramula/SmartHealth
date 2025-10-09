const express = require("express");
const router = express.Router();
const { createUser, verifyPassword, signToken } = require("../utils/auth");
const { User } = require("../models");

// Register
router.post("/auth/register", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "username and password required" });
    // Check exists
    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: "user exists" });
    const user = await createUser(username, password, email);
    return res.json({ id: user._id, username: user.username });
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

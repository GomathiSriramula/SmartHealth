const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");
const { createUser, verifyPassword, signToken, authMiddleware, requireRole, hashPassword } = require("../utils/auth");
const { User } = require("../models");
const { logAudit } = require("../utils/auditLogger");
const { sendEmail } = require("../utils/mailer");

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
    const { username: rawUsername, password, email: rawEmail, role } = req.body;
    // 🔑 FIX: this is the most public-facing account-creation path in the
    // app (unauthenticated, self-service) yet it previously had the WEAKEST
    // server-side validation of all of them -- no minimum password length
    // (a 1-character password was accepted; the only guard was an HTML
    // `minLength` attribute on the frontend form, trivially bypassed via a
    // direct API call) and no input trimming, unlike /auth/operators and
    // /auth/admins which both already enforce this.
    const username = (rawUsername || '').trim();
    const email = (rawEmail || '').trim();

    if (!username || !password || !email)
      return res.status(400).json({ error: "username, password, and email are required" });
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

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
    // Same race-condition handling as /auth/operators: a concurrent request
    // can slip past the findOne checks above and hit MongoDB's unique index
    // directly -- return a clean 409 instead of a raw E11000 message.
    if (e.code === 11000) {
      const field = Object.keys(e.keyPattern || {})[0] || 'field';
      return res.status(409).json({ error: `${field} already exists` });
    }
    return res
      .status(500)
      .json({ error: "registration failed", detail: e.message });
  }
});

router.post("/auth/operators", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, username, password, email: rawEmail, district: rawDistrict } = req.body;
    const operatorName = (name || username || '').trim();
    // 🔑 FIX: trim BEFORE the required-field check, not after. Previously
    // a whitespace-only district (e.g. "   ") passed the `!district` check
    // (a non-empty string is truthy) and was then trimmed down to "" when
    // stored. getUserDistrict()/buildDistrictFilter() treat an empty
    // district as "no restriction", so that operator silently got
    // unrestricted, ADMIN-equivalent read access across every district.
    const district = (rawDistrict || '').trim();
    const email = (rawEmail || '').trim();

    if (!operatorName || !password || !email || !district) {
      return res.status(400).json({
        error: "name, password, email, and district are required"
      });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
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
      locations: [district]
    });

    return res.status(201).json({
      operator: formatOperator(user)
    });
  } catch (e) {
    console.error(e);
    // A concurrent request can slip past the findOne checks above and hit
    // MongoDB's unique index instead -- surface that as the same clean 409
    // the normal path returns, rather than a raw E11000 error message.
    if (e.code === 11000) {
      const field = Object.keys(e.keyPattern || {})[0] || 'field';
      return res.status(409).json({ error: `${field} already exists` });
    }
    return res.status(500).json({ error: "operator creation failed", detail: e.message });
  }
});

router.get("/auth/operators", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { search } = req.query;
    const query = { role: 'OPERATOR' };
    if (search && search.trim()) {
      const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ username: re }, { email: re }, { locations: re }];
    }
    const operators = await User.find(query).sort({ created_at: -1 }).lean();
    return res.json({ operators: operators.map(formatOperator) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "failed to fetch operators", detail: e.message });
  }
});

/**
 * GET /auth/operators/csv-template
 * A blank CSV with the exact header row (+ one example row) expected by
 * POST /auth/operators/bulk-upload, so an admin doesn't have to guess
 * column names/order.
 */
router.get("/auth/operators/csv-template", authMiddleware, requireRole('ADMIN'), (req, res) => {
  const csvContent =
    "name,email,password,district\r\n" +
    "jane.doe,jane.doe@example.com,ChangeMe123!,Hyderabad\r\n";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="SmartHealth_Operators_Template.csv"');
  return res.send(csvContent);
});

/**
 * GET /auth/operators/export?format=csv|excel
 * Export the current operator roster. Registered before /auth/operators/:id
 * (that route is PUT/DELETE, different methods, but kept consistent with
 * the /alerts/export-before-/alerts/:id ordering rule used elsewhere).
 */
router.get("/auth/operators/export", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const operators = await User.find({ role: 'OPERATOR' }).sort({ created_at: -1 }).lean();
    const formatted = operators.map(formatOperator);

    const headers = ["Name", "Email", "State", "District", "Created At"];
    const rows = formatted.map((o) => [
      o.name,
      o.email,
      o.state,
      o.district,
      o.created_at ? new Date(o.created_at).toLocaleString() : "",
    ]);

    const format = (req.query.format || "csv").toLowerCase();
    if (format === "excel") {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, "Operators");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="SmartHealth_Operators_${Date.now()}.xlsx"`);
      return res.send(buffer);
    }

    const escapeCsv = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csvLines = [headers, ...rows].map((row) => row.map(escapeCsv).join(","));
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="SmartHealth_Operators_${Date.now()}.csv"`);
    return res.send(csvLines.join("\r\n"));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "failed to export operators", detail: e.message });
  }
});

router.put("/auth/operators/:id", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, username, password, email: rawEmail, district: rawDistrict } = req.body;
    const operatorName = (name || username || '').trim();
    const operatorId = req.params.id;
    // Same fix as POST /auth/operators: trim BEFORE validating so a
    // whitespace-only district can't slip through and strip the operator's
    // district restriction (see comment there for the full explanation).
    const district = (rawDistrict || '').trim();
    const email = (rawEmail || '').trim();

    const operator = await User.findById(operatorId);
    if (!operator || operator.role !== 'OPERATOR') {
      return res.status(404).json({ error: "operator not found" });
    }

    if (!operatorName || !email || !district) {
      return res.status(400).json({ error: "name, email, and district are required" });
    }

    const trimmedPassword = (password || '').trim();
    if (trimmedPassword && trimmedPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existingName = await User.findOne({ username: operatorName, _id: { $ne: operatorId } });
    if (existingName) return res.status(409).json({ error: "name already exists" });

    const existingEmail = await User.findOne({ email, _id: { $ne: operatorId } });
    if (existingEmail) return res.status(409).json({ error: "email already exists" });

    operator.username = operatorName;
    operator.email = email;
    operator.locations = [district];

    if (trimmedPassword) {
      operator.passwordHash = await hashPassword(trimmedPassword);
    }

    await operator.save();

    return res.json({ operator: formatOperator(operator) });
  } catch (e) {
    console.error(e);
    if (e.code === 11000) {
      const field = Object.keys(e.keyPattern || {})[0] || 'field';
      return res.status(409).json({ error: `${field} already exists` });
    }
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

// Storage config for the operator-CSV upload — mirrors uploads.js's pattern
// for case-report CSVs, but a much smaller size limit since operator lists
// are tiny compared to case-report batches.
const operatorUploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "operators-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const operatorUpload = multer({
  storage: operatorUploadStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || path.extname(file.originalname).toLowerCase() === ".csv") cb(null, true);
    else cb(new Error("Only CSV files are allowed!"), false);
  },
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

/**
 * POST /auth/operators/bulk-upload
 * CSV columns: name (or username), email, password, district.
 * ADMIN only. Creates one OPERATOR account per valid row; invalid rows are
 * skipped and reported back individually rather than failing the whole batch.
 */
router.post(
  "/auth/operators/bulk-upload",
  authMiddleware,
  requireRole('ADMIN'),
  operatorUpload.single("file"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const filePath = req.file.path;
    const rows = [];
    let lineNumber = 1;

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        lineNumber++;
        rows.push({ line: lineNumber, data });
      })
      .on("end", async () => {
        const errors = [];
        let created = 0;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        for (const { line, data } of rows) {
          try {
            const operatorName = (data.name || data.username || "").trim();
            const email = (data.email || "").trim();
            const password = (data.password || "").trim();
            const district = (data.district || data.location || "").trim();

            if (!operatorName || !email || !password || !district) {
              errors.push({ line, error: "Missing required field (name, email, password, district)", data });
              continue;
            }
            if (!emailRegex.test(email)) {
              errors.push({ line, error: "Invalid email format", data });
              continue;
            }
            if (password.length < 6) {
              errors.push({ line, error: "Password must be at least 6 characters", data });
              continue;
            }

            const existingUser = await User.findOne({ username: operatorName });
            if (existingUser) {
              errors.push({ line, error: `username "${operatorName}" already exists`, data });
              continue;
            }
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
              errors.push({ line, error: `email "${email}" already exists`, data });
              continue;
            }

            await createUser(operatorName, password, email, { role: 'OPERATOR', locations: [district] });
            created++;
          } catch (rowError) {
            if (rowError.code === 11000) {
              const field = Object.keys(rowError.keyPattern || {})[0] || 'field';
              errors.push({ line, error: `${field} already exists`, data });
            } else {
              errors.push({ line, error: rowError.message, data });
            }
          }
        }

        fs.unlinkSync(filePath);

        await logAudit({
          action: 'BULK_CREATE_OPERATORS',
          req,
          metadata: { totalRows: rows.length, created, failed: errors.length },
        });

        return res.json({
          message: "Operator CSV processed",
          summary: { totalRows: rows.length, created, failed: errors.length },
          errors: errors.slice(0, 20),
        });
      })
      .on("error", (error) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(500).json({ error: "CSV parsing failed", detail: error.message });
      });
  }
);

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

function formatUserAccount(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    created_at: user.created_at || user.createdAt || null,
  };
}

/**
 * GET /auth/users
 * List self-registered public USER accounts (ADMIN only). Optional
 * ?search= matches username or email (case-insensitive substring).
 * Deliberately scoped to role==='USER' only -- OPERATOR/ADMIN accounts have
 * their own dedicated list endpoints.
 */
router.get("/auth/users", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { search, limit = 50, skip = 0 } = req.query;
    const query = { role: 'USER' };
    if (search && search.trim()) {
      const re = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ username: re }, { email: re }];
    }
    const limitVal = Math.min(parseInt(limit, 10) || 50, 200);
    const skipVal = parseInt(skip, 10) || 0;

    const total = await User.countDocuments(query);
    const users = await User.find(query).sort({ created_at: -1 }).skip(skipVal).limit(limitVal).lean();

    return res.json({ users: users.map(formatUserAccount), total, limit: limitVal, skip: skipVal });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "failed to fetch users", detail: e.message });
  }
});

/**
 * DELETE /auth/users/:id
 * Remove a self-registered USER account (ADMIN only). Scoped to
 * role==='USER' only -- this must never be usable to delete an OPERATOR or
 * ADMIN account; those have their own dedicated, more careful delete flows.
 */
router.delete("/auth/users/:id", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'USER') {
      return res.status(404).json({ error: "user not found" });
    }

    await User.deleteOne({ _id: req.params.id });

    await logAudit({
      action: 'DELETE_USER',
      req,
      entityId: user._id,
      metadata: { deletedUsername: user.username, deletedEmail: user.email },
    });

    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "user delete failed", detail: e.message });
  }
});

function formatAdminAccount(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    created_at: user.created_at || user.createdAt || null,
  };
}

/**
 * POST /auth/admins
 * Create an additional ADMIN account (ADMIN only). Previously the only way
 * to add a second admin was via .env DEFAULT_ADMINS plus a server restart.
 */
router.post("/auth/admins", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password || !email) {
      return res.status(400).json({ error: "username, password, and email are required" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: "Invalid email format" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(409).json({ error: "username already exists" });
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(409).json({ error: "email already exists" });

    const admin = await createUser(username, password, email, { role: 'ADMIN' });

    await logAudit({
      action: 'CREATE_ADMIN',
      req,
      entityId: admin._id,
      metadata: { newAdminUsername: admin.username, newAdminEmail: admin.email },
    });

    return res.status(201).json({ admin: formatAdminAccount(admin) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "admin creation failed", detail: e.message });
  }
});

/**
 * GET /auth/admins
 * List ADMIN accounts (ADMIN only).
 */
router.get("/auth/admins", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const admins = await User.find({ role: 'ADMIN' }).sort({ created_at: -1 }).lean();
    return res.json({ admins: admins.map(formatAdminAccount) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "failed to fetch admins", detail: e.message });
  }
});

/**
 * DELETE /auth/admins/:id
 * Remove an ADMIN account (ADMIN only), with two safety checks:
 *  - you can never delete your OWN account through this endpoint (would
 *    lock the current session out with no recourse)
 *  - you can never delete the LAST remaining admin (would lock everyone out
 *    of admin-only functionality with no recovery path short of editing
 *    the database directly)
 */
router.delete("/auth/admins/:id", authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);
    if (!admin || admin.role !== 'ADMIN') {
      return res.status(404).json({ error: "admin not found" });
    }

    if (req.user.id === admin._id.toString()) {
      return res.status(400).json({ error: "You cannot delete your own admin account" });
    }

    const adminCount = await User.countDocuments({ role: 'ADMIN' });
    if (adminCount <= 1) {
      return res.status(400).json({ error: "Cannot delete the last remaining admin account" });
    }

    await User.deleteOne({ _id: req.params.id });

    await logAudit({
      action: 'DELETE_ADMIN',
      req,
      entityId: admin._id,
      metadata: { deletedUsername: admin.username, deletedEmail: admin.email },
    });

    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "admin delete failed", detail: e.message });
  }
});

/**
 * POST /auth/forgot-password
 * Public. Always returns the same generic message regardless of whether the
 * email is registered, so this endpoint can't be used to enumerate accounts.
 * If the email DOES match an account, emails a reset link valid for 1 hour.
 */
router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "email is required" });

    const genericResponse = { message: "If an account with that email exists, a password reset link has been sent." };

    const user = await User.findOne({ email });
    if (!user) {
      return res.json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;

    // 🔑 Deliberately NOT awaited. Awaiting the SMTP handshake made this
    // endpoint take ~5.4s for a registered address vs ~65ms for an unknown
    // one, which caused two problems:
    //   1. UX: the user sat on a "Sending..." button for 5+ seconds with no
    //      feedback, long enough to assume the feature was broken.
    //   2. Security: that 5s-vs-65ms difference was a timing side-channel
    //      revealing whether an address has an account — defeating the point
    //      of returning an identical generic response below.
    // Delivery failures are logged server-side only; the client gets the same
    // generic message either way. The .catch() is required — without it a
    // rejected floating promise becomes an unhandled rejection.
    sendEmail(
      user.email,
      "SmartHealth — Password Reset Request",
      `You requested a password reset. Visit this link to set a new password (valid for 1 hour):\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
      `<p>You requested a password reset for your SmartHealth account.</p><p><a href="${resetUrl}">Click here to reset your password</a> (valid for 1 hour).</p><p>If you didn't request this, you can safely ignore this email.</p>`
    )
      .then(() => {
        console.log(`✅ Password reset email queued for ${user.email}`);
      })
      .catch((emailError) => {
        console.error("❌ Failed to send password reset email:", emailError.message);
      });

    req.user = { username: user.username, role: user.role };
    await logAudit({ action: 'FORGOT_PASSWORD_REQUESTED', req, entityId: user._id });

    return res.json(genericResponse);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "request failed", detail: e.message });
  }
});

/**
 * POST /auth/reset-password
 * Public. Consumes a token issued by /auth/forgot-password to set a new
 * password.
 */
router.post("/auth/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: "email, token, and newPassword are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });
    if (!user || !user.resetPasswordTokenHash || !user.resetPasswordExpires) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }
    if (user.resetPasswordExpires.getTime() < Date.now()) {
      return res.status(400).json({ error: "Reset token has expired. Please request a new one." });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    if (tokenHash !== user.resetPasswordTokenHash) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    user.passwordHash = await hashPassword(newPassword);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpires = null;
    await user.save();

    req.user = { username: user.username, role: user.role };
    await logAudit({ action: 'RESET_PASSWORD', req, entityId: user._id });

    return res.json({ message: "Password reset successfully. You can now log in with your new password." });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "reset failed", detail: e.message });
  }
});

/**
 * PUT /auth/me/password
 * Any authenticated role can change their OWN password given the correct
 * current password. Distinct from PUT /auth/operators/:id (ADMIN resetting
 * someone else's password) -- this never requires ADMIN.
 */
router.put("/auth/me/password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword and newPassword are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "user not found" });

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "current password is incorrect" });

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    await logAudit({ action: 'CHANGE_PASSWORD', req, entityId: user._id });

    return res.json({ message: "Password changed successfully" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "password change failed", detail: e.message });
  }
});

module.exports = router;

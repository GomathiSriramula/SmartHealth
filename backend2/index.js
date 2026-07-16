require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const reportsRouter = require("./routes/reports");
const authRouter = require("./routes/auth");
const predictionsRouter = require("./routes/predictions");
const uploadsRouter = require("./routes/uploads");
const alertsRouter = require("./routes/alerts");
const alertsApiRouter = require("./routes/alertsApi");

const { ensureDefaultAdmin } = require("./utils/auth");

const app = express();

app.use(helmet());

const FRONTEND_ORIGINS =
  process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173";
const origins = FRONTEND_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (origins.indexOf(origin) !== -1) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// Rate limit auth endpoints specifically — brute force / spam protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const mongoConnected = mongoose.connection.readyState === 1;
    const status = mongoConnected ? 'healthy' : 'degraded';
    const statusCode = status === 'healthy' ? 200 : 503;

    return res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoConnected ? 'connected' : 'disconnected'
      }
    });
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      error: 'health check failed'
    });
  }
});

app.use("/", reportsRouter);
app.use("/", authRouter);
app.use("/", predictionsRouter);
app.use("/", uploadsRouter);
app.use("/alerts", alertsRouter);
app.use("/api", alertsApiRouter);

const PORT = process.env.PORT || 5000;

async function start() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set. Add it to your .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB"); // never log the URI — it contains credentials
  } catch (e) {
    console.error("Failed to connect to MongoDB:", e.message);
  }

  try {
    const defaultAdmins = await ensureDefaultAdmin();
    defaultAdmins.forEach((admin) => {
      console.log(`Default admin ready: ${admin.email}`);
    });
  } catch (e) {
    console.error("Failed to ensure default admin:", e.message);
  }

  app.listen(PORT, () => {
    console.log(`SmartHealth Node ingestion API listening on port ${PORT}`);
    const connected = mongoose.connection && mongoose.connection.readyState === 1;
    console.log(`MongoDB connected: ${connected ? "yes" : "no"}`);
  });
}

start();

module.exports = app;
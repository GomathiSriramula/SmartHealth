require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");

const reportsRouter = require("./routes/reports");

const authRouter = require("./routes/auth");
const predictionsRouter = require("./routes/predictions");
const uploadsRouter = require("./routes/uploads");
const alertsRouter = require("./routes/alerts");
const alertsApiRouter = require("./routes/alertsApi");

const { ensureDefaultAdmin } = require("./utils/auth");

const app = express();

const FRONTEND_ORIGINS =
  process.env.FRONTEND_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173";
const origins = FRONTEND_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin like mobile apps or curl
      if (!origin) return callback(null, true);
      if (origins.indexOf(origin) !== -1) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

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
      error: error.message
    });
  }
});

app.use("/", reportsRouter);

app.use("/", authRouter);
app.use("/", predictionsRouter);
app.use("/", uploadsRouter);
app.use("/alerts", alertsRouter);
app.use("/api", alertsApiRouter);

// Force the ingestion API to listen on port 5000 as requested
const PORT = 5000;

async function start() {
  const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/smart_health";
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`Connected to MongoDB at ${MONGODB_URI}`);
  } catch (e) {
    console.error("Failed to connect to MongoDB:", e.message);
    // still start; endpoints will error until DB is available
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
    // Print connection status for clarity
    const connected =
      mongoose.connection && mongoose.connection.readyState === 1;
    console.log(`MongoDB connected: ${connected ? "yes" : "no"}`);
  });
}

start();

module.exports = app;

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");

const reportsRouter = require("./routes/reports");
const sensorsRouter = require("./routes/sensors");
const authRouter = require("./routes/auth");
const predictionsRouter = require("./routes/predictions");
const uploadsRouter = require("./routes/uploads");
const mlRouter = require("./routes/ml");
const mlPredictionsRouter = require("./routes/mlPredictions");
const alertsRouter = require("./routes/alerts");
const predictionsApiRouter = require("./routes/predictionsApi");
const alertsApiRouter = require("./routes/alertsApi");

// Initialize alert manager after mlPredictions router is loaded (which defines MLAlert model)
const { initializeAlertModel } = require("./utils/alertManager");
initializeAlertModel();

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
const mlClient = require('./services/mlClient');

app.get('/health', async (req, res) => {
  try {
    const mongoConnected = mongoose.connection.readyState === 1;
    const mlHealth = await mlClient.checkHealth();

    const status = mongoConnected && mlHealth.healthy ? 'healthy' : 'degraded';
    const statusCode = status === 'healthy' ? 200 : 503;

    return res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoConnected ? 'connected' : 'disconnected',
        ml_service: mlHealth.healthy ? 'connected' : 'disconnected'
      },
      ml_service_details: mlHealth.data
    });
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

app.use("/", reportsRouter);
app.use("/", sensorsRouter);
app.use("/", authRouter);
app.use("/", predictionsRouter);
app.use("/", uploadsRouter);
app.use("/", mlRouter);
app.use("/ml-predictions", mlPredictionsRouter);
app.use("/alerts", alertsRouter);
app.use("/api", predictionsApiRouter);
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

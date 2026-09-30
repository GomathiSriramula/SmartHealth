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
const alertsApiRouter = require("./routes/alertsApi");
const auditLogsRouter = require("./routes/auditLogs");
const notificationsRouter = require("./routes/notifications");

const { ensureDefaultAdmin } = require("./utils/auth");

const app = express();

// Trust exactly one reverse-proxy hop (the platform's load balancer/ingress —
// Render, Railway, Heroku, Nginx, an ALB, etc.). Every real deployment target
// sits behind one, and without this Express reads the proxy's own IP off the
// socket for every request, not the real client's. That breaks two things
// silently: express-rate-limit below would bucket ALL users as one IP
// (one person's failed logins could rate-limit everyone), and the audit
// log's IP capture (utils/auditLogger.js) would record the same proxy IP
// for every actor, losing all forensic value. Adjust the hop count if you
// add another proxy layer in front of this one.
app.set('trust proxy', 1);

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
// "dev" is colored/concise for a local terminal; "combined" (Apache-style,
// includes client IP, timestamp, status, response size) is what you actually
// want in production log aggregation.
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

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
// Same protection for forgot/reset-password: both are unauthenticated public
// endpoints, and forgot-password sends a real email per request, so without
// a limit here it could be used to spam an arbitrary target's inbox.
app.use("/auth/forgot-password", authLimiter);
app.use("/auth/reset-password", authLimiter);

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
app.use("/api", alertsApiRouter);
app.use("/", auditLogsRouter);
app.use("/", notificationsRouter);

// JSON 404 for anything that didn't match a route above — keeps error
// responses consistent with the rest of the JSON API instead of Express's
// default HTML "Cannot GET /x" page.
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler (must be declared last, with 4 args, for Express to
// treat it as one). Without this, an uncaught error — e.g. malformed JSON
// in a request body, which body-parser throws on before any route handler
// runs — falls through to Express's default error handler, which renders
// a full server-side stack trace (absolute file paths, dependency internals)
// as the HTTP response body. That page is reachable pre-authentication on
// any POST endpoint, so it's a real information disclosure, not just a
// cosmetic issue. Log the real error server-side; never send it to the client.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error("Unhandled error:", err);
  const status = Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({
    error: status === 400 ? "Invalid request" : "Internal server error",
  });
});

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

  const server = app.listen(PORT, () => {
    console.log(`SmartHealth Node ingestion API listening on port ${PORT}`);
    const connected = mongoose.connection && mongoose.connection.readyState === 1;
    console.log(`MongoDB connected: ${connected ? "yes" : "no"}`);
  });

  // Process managers and CI send SIGTERM on redeploy/scale-down/shutdown,
  // not just Ctrl+C. Without handling it,
  // Node kills the process immediately — dropping any in-flight request and
  // leaving the Mongoose connection to close uncleanly. Stop accepting new
  // connections, let in-flight ones finish, then close Mongo before exiting.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      try {
        await mongoose.connection.close();
      } catch (e) {
        console.error("Error closing MongoDB connection:", e.message);
      }
      console.log("Shutdown complete.");
      process.exit(0);
    });
    // Don't hang forever waiting for slow/stuck connections to drain.
    setTimeout(() => {
      console.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start();

module.exports = app;
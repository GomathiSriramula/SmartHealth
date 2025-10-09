SmartHealth Node backend (backend2)

This folder contains a Node.js/Express replacement for the original Python FastAPI backend. It uses MongoDB (Mongoose) for storage and optionally publishes ingestion events to RabbitMQ.

Quick start

1. Copy `.env.example` to `.env` and edit values as needed.
2. Install dependencies:

```powershell
cd backend2; npm install
```

3. Start the server:

```powershell
npm start
```

API compatibility

- POST /report and POST /reports — create case report
- POST /reports/debug — debug payload (returns data types)
- GET /reports — list reports (query params: skip, limit)

- POST /sensor and POST /sensors — create sensor reading
- GET /sensors — list sensor readings (query params: skip, limit)

Authentication

- Send header `x-api-key` with the value in `API_KEY` env variable (default: `secret-key`).

Publisher

- If `RABBITMQ_URL` is set the server will publish events to the queue named `case_reports` or `sensor_readings`.
- If not set, the publish function logs the payload (fallback for local dev).

Notes

This service aims to preserve the API surface of the original Python backend. Field validation is intentionally permissive to match the original behavior. Adjust schemas and validation as needed for production.

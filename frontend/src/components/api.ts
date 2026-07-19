
// src/components/api.ts
//
// Single source of truth for the backend base URL.
//
// Every component previously hardcoded `const API_URL = "http://127.0.0.1:5000"`
// individually, which meant deploying to any environment other than local dev
// required editing 9 separate files. Now there's exactly one place to change.
//
// Configure the real backend URL via an environment variable at build time:
//   - Local dev:   create a `.env` file in the project root with
//                     VITE_API_URL=http://127.0.0.1:5000
//   - Production:  set VITE_API_URL to your deployed backend's URL
//                  (e.g. VITE_API_URL=https://api.yourdomain.com)
//
// If VITE_API_URL isn't set, this falls back to the local dev default so
// nothing breaks for anyone who hasn't created a .env file yet.
export const API_URL: string =
  (import.meta as any).env?.VITE_API_URL || "http://127.0.0.1:5000";
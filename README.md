# SHIVAM TOUR & TRAVELS — Render-ready API

Node.js + Express + SQLite API for the SHIVAM TOUR & TRAVELS accounting app.

## Local test

Requirements: Node.js 20+.

```bash
npm install
npm start
```

Health check: `http://localhost:8080/api/health`

Default first login (development only):
- Username: `admin`
- Password: value of `ADMIN_PASSWORD` (fallback is `ChangeMe123!`)

Change the password before real use.

## Render deployment

This package includes `render.yaml` and a `Dockerfile`.

### Option A — Blueprint
1. Put this folder in a GitHub repository.
2. In Render choose **New → Blueprint** and select the repository.
3. Render reads `render.yaml`.
4. Enter a strong `ADMIN_PASSWORD` when prompted.
5. Keep the generated `JWT_SECRET` private.
6. Deploy.
7. Confirm: `https://YOUR-SERVICE.onrender.com/api/health`

### Option B — Web Service
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Environment variables:
- `NODE_ENV=production`
- `JWT_SECRET` = long random secret
- `ADMIN_PASSWORD` = strong admin password
- `CORS_ORIGIN` = frontend URL (or `*` only for initial testing)
- `DB_FILE=shivam.sqlite`

## Important database note

This version uses SQLite for low-cost testing. A typical ephemeral web-service filesystem should NOT be treated as permanent accounting storage. Before using it for important real-world accounts, move the database to persistent storage/managed PostgreSQL or another durable database.

## API

- GET `/api/health`
- POST `/api/auth/login`
- GET `/api/me`
- GET/POST `/api/users`
- GET/POST `/api/customers`
- GET/POST `/api/vehicles`
- GET/POST `/api/bookings`
- GET/POST `/api/invoices`
- GET/POST `/api/payments`
- GET/POST `/api/expenses`
- POST `/api/sync`
- GET `/api/dashboard`

Production hardening still recommended: HTTPS, durable DB, backups, rate limiting, audit logs, secure token storage, and restricted CORS.

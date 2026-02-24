# Wineo Back

Node.js API for the Wineo front (Next.js). Auth first: register, login, JWT.

## Setup

```bash
cd wineo-back
cp .env.example .env
# Edit .env: set JWT_SECRET, CORS_ORIGIN, and MONGODB_URI (your MongoDB Atlas connection string)
npm install
```

## Run

```bash
npm run dev   # dev with auto-reload
npm start     # production
```

API base: `http://localhost:4000` (or your `PORT`).

## Auth API

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | `{ email, password, firstName, lastName }` | Register; returns `{ user, token }` |
| POST | `/auth/login` | `{ email, password }` | Login; returns `{ user, token }` |
| GET | `/auth/me` | — | Current user (header: `Authorization: Bearer <token>`) |

Frontend: send `Authorization: Bearer <token>` for protected requests; store token (e.g. cookie or localStorage) after login/register.

## Notes

- Users are stored in MongoDB (Mongoose). Set `MONGODB_URI` in `.env` (use your Atlas connection string; add database name if needed, e.g. `...mongodb.net/wineo`).
- Set a strong `JWT_SECRET` in production. Never commit `.env` or your real connection string.

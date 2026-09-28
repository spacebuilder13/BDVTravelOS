# BDV Travel OS — Claude Code Guide

Internal ops platform for Blue Diamond Voyage (travel agency): lead intake, quotations, itinerary planning, visa docs, CRM. Migrated off Emergent to a standard GitHub/Vercel/Railway stack so it can be maintained here going forward.

## Architecture

- `backend/server.py` — the entire FastAPI backend lives in this one file (~5,700 lines). All routes are under `/api` via `api_router`. There is no `models/`, `routes/`, or `services/` split — when adding features, follow the existing pattern of grouping related endpoints together in the file rather than introducing a new module structure, unless asked to refactor.
- `frontend/src/pages/*` — one file per top-level screen, routed in `frontend/src/App.js`. Key pages: `CRM.jsx` (Inquiry & Intake), `Quotations.jsx` (Quotation & Calculator), `Visa.jsx` (Visa Documents), plus `TripPlanner`/`PlannerCanvas`/`ItineraryDesigner`, `Transport`, `Maps`, `Browser`, `CompassHub`/`AIAssistant`.
- `frontend/src/services/*API.js` — thin axios wrappers per domain; all API calls go through `REACT_APP_BACKEND_URL`.
- Auth: staff log in with a name + 4-digit PIN (not email/password). JWT issued on login, stored as an httpOnly cookie (`bdvv_token`) with a Bearer-header fallback. See `get_current_user` in `server.py`.
- Database: MongoDB via Motor (`db = client[DB_NAME]`), collections are plain dicts, no ORM/schema layer.
- File uploads (enquiry PDFs, itinerary images) are written to local disk under `backend/uploads/`. This requires the backend host to have a **persistent volume** — on Railway that's a mounted volume on the backend service. If uploads ever start disappearing after a deploy, check the volume mount first.

## Environment variables

Backend (`backend/.env.example`): `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`, `LLM_API_KEY` (Anthropic key — used by the Compass AI Assistant and itinerary-AI features).

**Note on AI integration:** the original app called Emergent's `emergentintegrations` package (a thin LLM router keyed by `EMERGENT_LLM_KEY`). That package has since been pulled from PyPI and can no longer be installed outside Emergent's platform. It's been replaced with a small local `LlmChat`/`UserMessage`/`FileContent` shim near the top of the Compass AI section in `server.py` that calls the official `anthropic` SDK directly — the three call sites (`compass_chat`, the link-extraction endpoint, and `ai_generate_itinerary`) are otherwise unchanged. Model IDs were also updated from Emergent-era aliases (`claude-sonnet-4-5`/`-4-6`) to the current real Anthropic model ID `claude-sonnet-5`.

Frontend (`frontend/.env.example`): `REACT_APP_BACKEND_URL` — must point at the deployed backend's public URL, no trailing slash.

## Deployment topology

- Frontend on **Vercel**, root directory `frontend/`.
- Backend + MongoDB on **Railway**, backend root directory `backend/`, start command in `backend/Procfile`.
- Whenever the Vercel URL changes (e.g. a new preview/prod domain), update `CORS_ORIGINS` on the Railway backend to match, or the frontend will get CORS errors.

## First login

On startup against an empty database, `seed_database()` and `seed_protected_admins()` in `server.py` auto-create default staff accounts (see `DEFAULT_STAFF`), including an admin account with PIN `0000`. No manual seeding needed for a fresh environment.

## Known limitations / next phase

- **Database is MongoDB, not Postgres.** The original brief calls for an eventual Supabase (Postgres) migration — that has **not** happened yet. This is a deliberate, larger follow-up project (rewriting the data layer across `server.py`), not something to do incidentally while fixing a UI bug.
- No demo/prod environment separation yet — there is currently one deployment. Splitting this out (e.g. separate Railway/Vercel environments with separate Mongo databases) is part of the same later phase as the Supabase migration.
- File uploads are local-disk based, not object storage (S3/Supabase Storage) — fine for now given the Railway volume, but worth revisiting if the app needs to run on a platform without persistent disks.

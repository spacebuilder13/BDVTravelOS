# BDV Travel OS

This file is the working contract for this repo. Codex, Claude Code, and Cursor should all follow it.

- Codex pastes this file at the start of a session.
- Claude Code pastes `CLAUDE.md`. That file imports this one. While `CLAUDE.md` exists, Claude skips a sibling `AGENTS.md` unless the import is there.
- Cursor pastes this file. It also pastes `CLAUDE.md`, and it does not expand `@import`, so `CLAUDE.md` stays a doorway.
- Project facts live here. Personal rules outside the repo still apply on top. Do not start a second copy in `CODEX.md`, `CURSOR.md`, or a Cursor rule that only says "read AGENTS.md".

Do not commit secrets, `.env` files, or new files under `backend/uploads/`. There is no automated test suite on `main` yet. Say what you actually ran. Do not invent a pytest command.

One kind of change per pull request. Use the PR template. Note deploy impact for Vercel, Railway, and env vars, and say so if routing, auth, data shape, or deploy topology changed.

## Pull request diagrams (PR Lens)

`main` is production. Never push or merge to it. One task per branch: `utsav/<slug>` on Cursor, `harsh/<slug>` in Claude Code, `codex/<slug>` in Codex. A merge needs one approving review from someone other than the author.

If a pull request changes architecture, routing, auth, data shape, deploy topology, or env vars, update the matching `docs/` page in the same pull request (regenerate the diagram pages from `docs/specs/`).

Every pull request carries a PR Lens diagram. Before opening or updating a PR:

- Diff against the merge base, not the tip of `main`.
- Write `.pr-lens/graph.json`, validate it, and render it with the light theme.
- Put the architecture diagram at the top of the PR body. Add a data-flow diagram only when the change has a sequence.
- Show the diagrams and how they match the plan, and wait for a person before you open or update the PR.
- Do not commit `.pr-lens/`. Corrections go in `.github/pr-lens.yml`.

Load the skill from the folder for the agent you are:

- Cursor: `.cursor/skills/pr-lens/SKILL.md`
- Claude Code: `.claude/skills/pr-lens/SKILL.md`
- Codex: `.agents/skills/pr-lens/SKILL.md`

The three copies are identical. If you change one, change the other two.

## Architecture

- `backend/server.py` — the entire FastAPI backend lives in this one file (~5,700 lines). All routes are under `/api` via `api_router`. There is no `models/`, `routes/`, or `services/` split — when adding features, follow the existing pattern of grouping related endpoints together in the file rather than introducing a new module structure, unless asked to refactor.
- `frontend/src/pages/*` — one file per top-level screen, routed in `frontend/src/App.js`. Key pages: `CRM.jsx` (Inquiry & Intake), `Quotations.jsx` (Quotation & Calculator), `Visa.jsx` (Visa Documents), plus `TripPlanner`/`PlannerCanvas`/`ItineraryDesigner`, `Transport`, `Maps`, `Browser`, `CompassHub`/`AIAssistant`.
- `frontend/src/services/*API.js` — thin axios wrappers per domain; all API calls go through `REACT_APP_BACKEND_URL`.
- `docs/` — standalone architecture docs, separate from the app. `frontend/scripts/copy-docs.js` (the `prebuild` step) copies `docs/*.html` into `frontend/public/docs/` (gitignored) and `frontend/vercel.json` serves them at `/docs`. Open to anyone with the link; the app itself is login-gated. Nothing in `frontend/src` or `backend/` reads them. `docs/architecture.html` and `docs/deployment.html` are generated from `docs/specs/*.json` with Archify (see `docs/specs/README.md`); change the spec and regenerate, never hand-edit them.
- Auth: staff log in with a name + 4-digit PIN (not email/password). JWT issued on login, stored as an httpOnly cookie (`bdvv_token`) with a Bearer-header fallback. See `get_current_user` in `server.py`.
- Database: MongoDB via Motor (`db = client[DB_NAME]`), collections are plain dicts, no ORM/schema layer.
- File uploads (enquiry PDFs, itinerary images) are written to local disk under `backend/uploads/`. This requires the backend host to have a **persistent volume** — on Railway that's a mounted volume on the backend service. If uploads ever start disappearing after a deploy, check the volume mount first.

## Environment variables

Backend (`backend/.env.example`): `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `CORS_ORIGINS`, `LLM_API_KEY` (Anthropic key — used by the Compass AI Assistant and itinerary-AI features). `JWT_SECRET` is required at startup. There is no built-in fallback.

**Note on AI integration:** the original app called Emergent's `emergentintegrations` package (a thin LLM router keyed by `EMERGENT_LLM_KEY`). That package has since been pulled from PyPI and can no longer be installed outside Emergent's platform. It's been replaced with a small local `LlmChat`/`UserMessage`/`FileContent` shim near the top of the Compass AI section in `server.py` that calls the official `anthropic` SDK directly — the three call sites (`compass_chat`, the link-extraction endpoint, and `ai_generate_itinerary`) are otherwise unchanged. Model IDs were also updated from Emergent-era aliases (`claude-sonnet-4-5`/`-4-6`) to the current real Anthropic model ID `claude-sonnet-5`.

Frontend (`frontend/.env.example`): `REACT_APP_BACKEND_URL` — must point at the deployed backend's public URL, no trailing slash.

## Deployment topology

- Frontend on **Vercel**, root directory `frontend/`. The Vercel project root has to be `frontend/`, because there is no app at the repo root.
- Backend + MongoDB on **Railway**, backend root directory `backend/`, start command in `backend/Procfile`.
- Whenever the Vercel URL changes (e.g. a new preview/prod domain), update `CORS_ORIGINS` on the Railway backend to match, or the frontend will get CORS errors.

## First login

On startup against an empty database, `seed_database()` and `seed_protected_admins()` in `server.py` auto-create default staff accounts (see `DEFAULT_STAFF`), including an admin account with PIN `0000`. No manual seeding needed for a fresh environment.

## Known limitations / next phase

- **Database is MongoDB, not Postgres.** The original brief calls for an eventual Supabase (Postgres) migration — that has **not** happened yet. This is a deliberate, larger follow-up project (rewriting the data layer across `server.py`), not something to do incidentally while fixing a UI bug.
- No demo/prod environment separation yet — there is currently one deployment. Splitting this out (e.g. separate Railway/Vercel environments with separate Mongo databases) is part of the same later phase as the Supabase migration.
- File uploads are local-disk based, not object storage (S3/Supabase Storage) — fine for now given the Railway volume, but worth revisiting if the app needs to run on a platform without persistent disks.

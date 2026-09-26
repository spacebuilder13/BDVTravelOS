<div align="center">

# BDVTravelOS - Engineering Overview

**Internal operations platform for BDV** · migrating from a single-repo Emergent build to a modern GitHub → Vercel → Supabase stack

![Status](https://img.shields.io/badge/status-Phase%201%20migration-yellow)
![Frontend](https://img.shields.io/badge/frontend-React%20%2F%20Vercel-blue)
![Backend](https://img.shields.io/badge/backend-FastAPI%20%2F%20Railway-009688)
![Database](https://img.shields.io/badge/database-MongoDB%20→%20Supabase-47A248)
![Access](https://img.shields.io/badge/visibility-private-lightgrey)

Prepared by Harsh Shah (SNA) · last updated Sep 24, 2026

</div>

---

This file lives in `/docs` alongside the architecture diagrams it references. It's written for anyone new to the BDVTravelOS migration project.
Every claim below is either **confirmed** (pulled directly from this repo's code, or a live check of a connected system) or **pending** (not yet decided, or not yet verifiable) - flagged rather than guessed.

## Contents

- [At a Glance](#at-a-glance)
- [Current Scope](#-current-scope)
- [Team & Roles](#-team--roles)
- [Access Control](#-access-control)
- [Database](#️-database)
- [Network & Infrastructure](#-network--infrastructure)
- [How the OS Works](#️-how-the-os-works)
- [Diagrams](#-diagrams)
- [Viewing the Diagrams](#-viewing-the-diagrams)
- [Open Items & Next Steps](#-open-items--next-steps)

---

## At a Glance

| | |
| --- | --- |
| **Frontend** | React (CRA/craco), deployed on Vercel |
| **Backend** | FastAPI, deployed on Railway |
| **Database (current)** | MongoDB, via Motor - 35 collections |
| **Database (target)** | Supabase (Postgres) - not started yet |
| **Auth** | Staff name + 4-digit PIN → JWT in an httpOnly cookie |
| **Repo structure (planned)** | `/demo` (untouched original) + `/prod` (Phase 1 modules, live) |
| **Phase 1 modules** | Dashboard · CRM (Visa + Docs) · Trip Planner (Inquiry + Quotation) |

---

## 🎯 Current Scope

BDVTravelOS is being migrated off its original Emergent-built stack onto a new stack: a private GitHub repository, Vercel for deployment, and Supabase for the database.

**Migration approach**

1. The full Emergent-era repo was copy-pasted as-is into a new private GitHub repo (done).
2. That new repo will hold two top-level folders: `/demo` (the untouched Emergent copy, kept as reference/rollback - not deployed) and `/prod` (where the real migration work happens, module by module - this is what deploys live on the Vercel link).

**Phase 1 — three modules move into `/prod`:**

- Dashboard
- CRM (Visa module + Docs module)
- Trip Planner (Inquiry + Quotation)

Everything else in the original app stays in `/demo` until a later phase.

**Enablement track** (parallel to the migration itself):

- A Claude Code learning guide for Yash Doshi and his team → see [`yash-claude-code-usage-guide.md`](./yash-claude-code-usage-guide.md)
- Live Co-Claude sessions with Yash Doshi and his team

These two items are about building the BDV team's own capability to work with Claude Code, alongside the SNA team doing the migration.

---

## 👥 Team & Roles

| Person | Side | Role |
| --- | --- | --- |
| Yash Doshi | BDV | Administrator |
| Isha Doshi | BDV | Administrator |
| Dolly Doshi | BDV | Administrator |
| Neel Doshi | BDV | Administrator |
| Priyanka | BDV | Operations |
| Utsav Modi | SNA (Spaceships & Atoms) | Mentor |
| Harsh Shah | SNA (Spaceships & Atoms) | Migration Associate |
| Jash Doshi | SNA (Spaceships & Atoms) | Harness Engineer |

SNA is the outside team helping BDV execute this migration; the BDV-side names are the OS's actual business users and administrators.

---

## 🔐 Access Control

> Confirmed directly from this repo (`backend/server.py`), not inferred.

**Login:** staff pick their name and enter a 4-digit PIN (no email/password) at `/api/auth/login`. A JWT is issued and stored as an httpOnly cookie (`bdvv_token`, 24-hour expiry). Accounts are provisioned by an admin — there is no self-signup.

**Protected admins:** `PROTECTED_ADMINS = {"yash doshi", "dolly doshi", "isha doshi", "neel doshi"}` is hardcoded in `server.py`. A startup routine (`seed_protected_admins`) guarantees all four always exist with `role: admin` and `is_protected: true`, re-marking them protected on every boot. Protected admins cannot be deleted and cannot have their role changed away from admin — both enforced server-side.


**Role enforcement is narrow:** of 154 API routes in `server.py`, only 5 check `role == "admin"` — create staff, update staff, delete staff, reset a staff member's PIN, and update brand/site settings. Every other route (CRM, Trip Planner, Visa, Quotations, etc.) only requires a valid login; any authenticated staff member can read and write there regardless of role. There is no module-level permission system — e.g. Priyanka's account isn't restricted from Trip Planner, nor is a `sales` account restricted from Visa/Docs.

> ⚠️ **Worth flagging:** default PINs ship as literal values in the seed data and should be rotated before this goes live for real use.

---

## 🗄️ Database

> Confirmed directly from this repo.

**Engine today:** MongoDB, accessed via Motor (`motor.motor_asyncio.AsyncIOMotorClient`) - not Postgres/Supabase yet. Connection comes from the `MONGO_URL` + `DB_NAME` env vars (`backend/.env.example` defaults `DB_NAME=bdv_travel_os`).

**Schema:** no ORM or schema layer - collections are plain dicts, validated only at the Pydantic request-model level in FastAPI, not at the database itself.

<details>
<summary><strong>Collections (35 total, one database)</strong></summary>
<br>

`staff` · `enquiries` · `clients` · `client_documents` · `quotes` · `quote_terms_template` · `trips` · `trip_components` · `trip_legs` · `trip_stops` · `trip_stays` · `trip_attractions` · `trip_restaurants` · `trip_pins` · `trip_meeting_points` · `trip_info_points` · `itineraries` · `bookings` · `transport_bookings` · `visa_applications` · `sources` · `saved_sites` · `places` · `destination_db` · `quick_links` · `notes` · `alerts` · `activity_log` · `ai_chat_sessions` · `ai_chat_messages` · `whatsapp_messages` · `tax_profiles` · `brand_settings` · `counters` · `file_uploads`

</details>

**Target:** Supabase (Postgres) is the stated destination for `/prod`, but `CLAUDE.md` in this repo explicitly calls this out as a separate, deliberate follow-up — not started yet. No Supabase project for BDVTravelOS exists in the connected Supabase account either as of this writing.

**File uploads aren't in the database:** they're written to local disk under `backend/uploads/` and served at `/api/uploads/...`. This needs a persistent volume on whatever host runs the backend (currently a Railway volume) - worth flagging if `/prod`'s backend ever moves off Railway, or if uploads should move to object storage (S3/Supabase Storage) as part of the same phase as the Postgres migration.

---

## 🌐 Network & Infrastructure

> Confirmed directly from this repo, combined with a live check of the connected Vercel project.

**Two separate hosts, cross-domain:** frontend on Vercel (root directory `frontend/`, `yarn build` → static `build/` output, all routes rewritten to `index.html` - a client-side-routed SPA); backend + MongoDB on Railway (root directory `backend/`, started via `Procfile`: `uvicorn server:app --host 0.0.0.0 --port $PORT`).

**Cross-site auth by design:** because Vercel and Railway are different domains, the auth cookie is set with `samesite="none"; secure=true` - required for it to survive a cross-site request. The backend's `CORS_ORIGINS` env var is a comma-separated allow-list that must be kept in sync with whatever Vercel URL is currently live; the code's own comment warns that a stale `CORS_ORIGINS` after a Vercel URL change causes CORS failures on the frontend with no obvious error message.

**No `/demo` / `/prod` split in this codebase yet:** as of this writing this repo is still one flat tree (`backend/`, `frontend/`), matching `CLAUDE.md`'s own note: *"No demo/prod environment separation yet - there is currently one deployment."* The `/demo` + `/prod` folder split described in Current Scope is the plan for the next step.

**Live Vercel project (`bdv-travel-os`):** no custom domain attached, Vercel Authentication (SSO) on for all deployments except custom domains, no framework auto-detected, and the project isn't marked live - consistent with `/prod` not having this application's code pushed to it yet. Confirmed: `/prod` stays on the current `vercel.app` URL, no custom domain planned for go-live.

> ⚠️ **Worth flagging:** `JWT_SECRET` has a hardcoded fallback (`'bdvv-secret-key-2024'`) if the env var isn't set on the host - worth confirming the real Railway environment actually overrides this rather than running on the default.

---

## ⚙️ How the OS Works

### High Level

BDVTravelOS is BDV's internal operations tool: staff log in, see a Dashboard, manage travel inquiries and quotations in the Trip Planner, and track customer visas and documents in the CRM. A person fills out or updates something in the browser; that action goes to a backend service, which stores it and, in places, calls an AI (Claude) to help draft or process content; the result comes back to the browser.

This description reflects the original Emergent-built version of the app (now the `/demo` copy). The new `/prod` version, covering only Dashboard, CRM, and Trip Planner for Phase 1, has not yet been built - its high-level flow should match this pattern but needs confirming once that code exists.

### Low Level

**As inspected in the `/demo` (original Emergent) codebase:**

- Frontend: React app, deployed on Vercel.
- Backend: FastAPI service, deployed on Railway (a `Procfile` drives that deployment).
- Database: MongoDB, hosted as a Railway service alongside the backend - not Postgres/Supabase at that point.
- AI integration: the backend calls Claude directly for AI-assisted features.
- Deploy path: pushes to the repo trigger the frontend redeploy on Vercel and the backend redeploy on Railway independently - two separate deploy targets, not one.

**What changes for `/prod` (pending - not yet built):**

- Database moves from MongoDB to Supabase (Postgres) - this changes the backend's data-access layer for whichever of Dashboard, CRM, and Trip Planner get migrated.
- Whether the backend stays on Railway/FastAPI or moves fully onto Vercel functions has not been decided/confirmed here.
- Exact request flow, endpoint list, and schema for the three Phase 1 modules should be cross-checked against the diagrams below once `/prod` exists.

---

## 📊 Diagrams

Generated via [Archify](https://github.com/tt-a1i/archify) in Claude Code, run directly against this repo. All files sit in this same `/docs` folder — click through locally, or once a Vercel project is pointed at `/docs`, at `<vercel-url>/<filename>`.

| # | Diagram | Scope | File |
| --- | --- | --- | --- |
| 1 | Runtime Architecture | 8–12 core components, one primary request path, trust boundaries between Vercel and Railway | [`architecture.html`](./architecture.html) |
| 2 | Request Data Flow | Frontend → backend → MongoDB → Compass AI, end to end | [`data-flow.html`](./data-flow.html) |
| 3 | Login → Trip Planner Data Flow | Scoped to Yash's login plus the Trip Planner module only | [`dataflow-login-tripplanner.html`](./dataflow-login-tripplanner.html) |
| 4 | MongoDB Collection Relationships | All 35 collections, relationships inferred (no ORM in the codebase) | [`schema.html`](./schema.html) |
| 5 | Deployment Topology | Vercel + Railway split, env vars, cross-domain cookie/CORS relationship | [`deployment.html`](./deployment.html) |
| 6 | API Map | All 154 routes grouped by feature, admin-only vs. open-to-any-staff marked | [`api-map.html`](./api-map.html) |
| 7 | Inquiry to Quotation (sequence) | One end-to-end user flow, call by call | [`flow-booking.html`](./flow-booking.html) |
| 8 | Frontend Component Map | Pages, per-page API services, shared contexts | [`components.html`](./components.html) |
| 9 | Phase 1 Migration Map | Dashboard / CRM / Trip Planner scoped against the full Emergent-era app | [`migration-map.html`](./migration-map.html) |

**Suggested walkthrough order for onboarding Jash:**

`Architecture (1)` → `Deployment Topology (5)` → `Login→Trip Planner flow (3)` → `Schema (4)` → `API Map (6)` → `Migration Map (9)`

Component Map (8) and the general Data Flow / Inquiry-to-Quotation diagrams (2, 7) are better as reference material — they overlap with #3 and #1.

---

## 👀 Viewing the Diagrams

Each diagram is a single self-contained HTML file — nothing to install, no server to run.

> ⚠️ **GitHub's file viewer shows raw source code, not the rendered diagram.** Clicking a `.html` file on github.com will show you a wall of code, not the picture. Use one of the two options below instead.

**Option A — Open locally (works right now, no setup)**

1. Clone the repo, or pull if you already have it:
   ```
   git clone <repo-url>
   ```
2. Open the `docs/` folder on your computer (File Explorer / Finder).
3. Double-click any `.html` file — it opens directly in your default browser as a local page.
4. Repeat for any other diagram — each file is independent, so there's nothing else to download or configure.

**Option B — Open via Vercel (once the `/docs` deployment is live)**

Once a Vercel project is pointed at this `/docs` folder (tracked in [Open Items](#-open-items--next-steps) below), every diagram gets a real URL:

1. Go to `<vercel-url>/<filename>` — for example `bdv-architecture.vercel.app/architecture.html`.
2. No cloning or downloading needed — works from any device, browser tab, or shared link.
3. Worth bookmarking: **Architecture** and **Deployment Topology** are the two most people come back to.

**If a diagram opens blank or looks broken:** the file didn't fully download — each one is ~800 KB. Re-clone or re-download and try again.

---

## 📋 Open Items & Next Steps

- [ ] Confirm GitHub collaborator list and permission levels for all 5 BDV users + SNA team on the private repo
- [ ] Confirm whether a BDV-owned Supabase project already exists; if not, provision one and connect it
- [ ] Confirm the `/prod` root directory and framework settings on the `bdv-travel-os` Vercel project
- [x] Repo shared, all 9 diagrams generated - see [Diagrams](#-diagrams) above. Low-Level section still worth a pass against the diagrams to replace remaining inferred detail
- [ ] Schedule Jash's first Co-Claude session and confirm which of the three Phase 1 modules he starts on
- [x] Custom domain - confirmed not needed; `/prod` stays on the `vercel.app` preview URL

---

<div align="center">

Questions about this doc → Harsh Shah ·

</div>

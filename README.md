# BDV Travel OS

Internal operations platform for Blue Diamond Voyage & Vision (BDV) — a travel agency. Covers lead intake, quotations, itinerary planning, visa document tracking, and a CRM, built for BDV's staff to run day-to-day agency operations.

Originally prototyped on [Emergent](https://emergent.sh); this repo is the migrated, standalone version meant to be run and extended on GitHub/Vercel/Railway.

## Stack

- **Frontend**: React 19 (Create React App via [craco](https://craco.js.org/)), Tailwind CSS, shadcn/Radix UI — deployed on [Vercel](https://vercel.com)
- **Backend**: FastAPI (single app in `backend/server.py`) — deployed on [Railway](https://railway.app)
- **Database**: MongoDB (via Motor) — hosted as a Railway service
- **AI features**: Anthropic Claude via a local `LlmChat` compatibility shim in `backend/server.py`

See [`AGENTS.md`](./AGENTS.md) for agent workflow rules and [`CLAUDE.md`](./CLAUDE.md) for the Claude-oriented architecture rundown.

## Modules

- **Inquiry & Intake** — capture and triage new leads (`CRM` / Dashboard)
- **Quotation & Calculator** — build and price client quotes (`Quotations`)
- **Visa Documents** — track visa document requirements and uploads (`Visa`)
- Plus: trip/itinerary planning, transport, maps, an in-app browser, and a Compass AI assistant

## Local development

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in MONGO_URL, JWT_SECRET, etc.
uvicorn server:app --reload
```

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env   # set REACT_APP_BACKEND_URL to your backend URL
yarn start
```

## Deployment

- **Frontend** → Vercel, root directory `frontend/`, build command `craco build`, output `build/`
- **Backend** → Railway, root directory `backend/`, start command from `backend/Procfile`
- **Database** → MongoDB service on Railway (or any MongoDB URI in `MONGO_URL`)

On first run against an empty database, the backend auto-seeds default staff logins (see `DEFAULT_STAFF` in `backend/server.py`) — no manual database setup needed to log in.

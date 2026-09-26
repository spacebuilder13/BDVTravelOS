<div align="center">

# Claude Code for BDVTravelOS — Usage Guide for Yash

**How Yash Doshi (and the BDV team) works with this repo through Claude Code**

Prepared by Harsh Shah (SNA) · last updated Sep 26, 2026

</div>

---

This is the "enablement track" doc referenced in [`docs/README.md`](./README.md) under Current Scope — it's written for Yash directly, not for the SNA engineering side. It answers one question: **when Yash wants BDVTravelOS to do something, how does he actually ask Claude Code to do it?**

## Contents

- [1. How Yash Gets Into a Session](#1-how-yash-gets-into-a-session)
- [2. The Golden Rule: One Repo, Two Doors](#2-the-golden-rule-one-repo-two-doors)
- [3. Use Case: Find a Bug](#3-use-case-find-a-bug)
- [4. Use Case: UI Changes](#4-use-case-ui-changes)
- [5. Use Case: New Feature](#5-use-case-new-feature)
- [6. Use Case: Database CRUD Operations](#6-use-case-database-crud-operations)
- [7. Use Case: Document Uploads / Corrections](#7-use-case-document-uploads--corrections)
- [8. What Yash Should Never Ask Claude to Do Directly](#8-what-yash-should-never-ask-claude-to-do-directly)
- [9. Quick Reference](#9-quick-reference)

---

## 1. How Yash Gets Into a Session

Two ways to reach Claude Code on this repo, and Yash will use both depending on the task:

| Entry point | When to use it | What it looks like |
| --- | --- | --- |
| **Claude Code on the web** (claude.ai/code) | Anything code-related: bug fix, new screen, new endpoint, a change that should end up as a commit/PR on `bdvtravelos` | Open a session against the `spacebuilder13/bdvtravelos` repo, describe the task in plain English, review the diff, approve the PR |
| **Live Co-Claude session** (screen-share with Harsh/Jash) | Learning the workflow itself, anything ambiguous, first few times doing a given use case | Same tool, but driven together until Yash is comfortable doing it solo |

Yash does **not** need to touch git, a terminal, Railway, or Vercel directly for any of the use cases below — Claude Code handles branching, committing, and pushing. Yash's job is to describe what's wrong or what's wanted, and to review/approve the result (in a live session) or read the PR description (async).

**One rule that never changes:** every change goes through a pull request, never straight to `main`. Someone (Harsh, Jash, or a BDV admin once trained) reviews and merges. This is what keeps a bad AI-suggested change from reaching the live app.

---

## 2. The Golden Rule: One Repo, Two Doors

BDVTravelOS is one codebase with two surfaces that non-technical users touch differently:

- **The app itself** (`bdv-travel-os.vercel.app` or whatever the live URL is) — this is where Yash's team does their actual day-to-day work: entering enquiries, building quotes, uploading visa docs. Nothing here talks to Claude Code directly.
- **This repo, through Claude Code** — this is where Yash asks for the app to be *changed*. Every use case below is really the same loop: **describe → Claude drafts the change → you look at it → it becomes a PR → someone merges it → it deploys.**

Nothing Yash types into a Claude Code session touches the live database or the live site immediately. Claude works in the repo; deployment happens afterward (Vercel/Railway auto-deploy on merge to `main`, per [`docs/README.md`](./README.md#-network--infrastructure)).

---

## 3. Use Case: Find a Bug

**Example prompt:** *"When I try to upload a passport scan on the Visa page, the file picker opens but nothing happens after I select a file."*

What happens:
1. Claude reads the relevant frontend page (`frontend/src/pages/Visa.jsx`), its API wrapper, and the matching backend route in `backend/server.py`.
2. Claude reproduces the bug in reasoning (and in a live session, in the running app) to confirm the root cause before touching code.
3. Claude proposes and applies the fix, then explains in plain language what was wrong and what changed.
4. Fix goes out as a PR for review.

**Yash's part:** describe the symptom as specifically as possible — which page, what you clicked, what you expected vs. what happened, whether it's every time or sometimes. Screenshots help a lot; Claude Code can read images.

---

## 4. Use Case: UI Changes

**Example prompt:** *"On the CRM inquiry list, add a filter so I can see only enquiries from the last 7 days."* or *"Make the Quotation PDF preview button more visible — it's easy to miss."*

What happens:
1. Claude finds the relevant page under `frontend/src/pages/` and any shared components it uses.
2. Claude makes the change and, where practical, runs the dev server and takes a screenshot to confirm it looks right before proposing it.
3. Small/contained UI tweaks (copy changes, button styling, adding a filter to an existing list) are usually a single short PR.

**Yash's part:** describe what should look/behave differently and, if you have one in mind, roughly where (which page, which section). A reference screenshot or a sketch of what you want is fine to share.

---

## 5. Use Case: New Feature

**Example prompt:** *"I want a way to mark a quotation as 'sent to client' and track when the client viewed it."*

This is bigger than a bug fix or a UI tweak, so it goes through an extra step:

1. Claude reads the existing pattern for similar features (e.g. how quote status is currently tracked in `server.py` and `Quotations.jsx`) so the new feature matches the app's conventions instead of introducing a new one.
2. Claude proposes a short plan first — new field(s), new endpoint(s), what the UI change looks like — before writing code, so Yash can redirect early if it's not what he meant.
3. Once approved, the feature is built across backend + frontend together and shipped as one PR (or a few, if it's large).

**Yash's part:** describe the outcome you want, not the implementation — "I want to know when a client has viewed the quote" is enough; Claude will figure out the data model and UI. Expect a back-and-forth on scope for anything non-trivial before code gets written.

---

## 6. Use Case: Database CRUD Operations

This covers two different things — worth keeping them separate:

**(a) "Add a field / change how something is stored"** — e.g. *"Add a 'preferred contact method' field to client records."* This is a code change: Claude edits the Pydantic model and the relevant routes in `server.py`, and the corresponding form/display in the frontend. Goes through the normal PR flow above.

**(b) "Fix/change actual data that's already in the database"** — e.g. *"Client X's enquiry got duplicated, please remove the extra one."* This is a **live data change**, not a code change, and BDVTravelOS currently has no admin UI for arbitrary record edits. Two options, in order of preference:

1. **Prefer doing it through the app UI** where a screen already exists for that data (editing a client record, correcting a quote line item, etc.) — this is safest because it goes through the same validation the app itself uses.
2. **If no UI exists for it,** this needs a one-off, reviewed script or a direct database action run by Harsh/Jash against the actual Railway MongoDB instance — Claude Code sessions on this repo do not have standing write access to the live production database, and shouldn't be given it. Flag these to SNA directly rather than asking Claude Code in a repo session to "just go fix the record."

**Yash's part:** if it's "the app should behave differently going forward," that's a repo change — ask Claude Code as usual. If it's "this specific record is wrong right now," that's a live-data request — flag it to Harsh/Jash rather than expecting a repo-session prompt to touch production data directly.

---

## 7. Use Case: Document Uploads, Corrections, etc.

Answering the specific question from the brief: **should this be from the UI, from chat, or both?**

**Both — but for different things:**

- **Actually uploading a client's passport/visa document** → always through the app UI (Visa module), the way staff do it today. File uploads land on the backend's local disk under `backend/uploads/` and are tied to a specific client/enquiry record — this is a live-app action, not something to route through a Claude Code chat session. Same logic as 6(b) above: this is live data, not code.
- **Fixing how uploads *work*** (e.g. "PDF uploads over 10MB fail silently," "let staff upload multiple visa docs at once," "show a progress bar while uploading") → that's a code/feature change, so it goes through Claude Code exactly like the UI/feature use cases above.
- **Correcting a mistake in an already-uploaded document's metadata** (wrong document type tagged, attached to the wrong client) → this is live data (case 6b) — fix it in the app UI if there's a screen for it; if not, flag to Harsh/Jash, don't ask a Claude Code repo session to reach into `backend/uploads/` directly.

**Rule of thumb Yash can apply generally:** if the answer to "does this change what the app *does*" is yes → Claude Code, repo session, PR review. If the answer to "does this change what a specific record currently *holds*" is yes → app UI first, SNA direct request second. Claude Code is for changing the software, not for being a side-channel into the live database or file storage.

---

## 8. What Yash Should Never Ask Claude to Do Directly

- Push straight to `main` / skip PR review, even for "just a tiny fix."
- Edit live production data directly from a Claude Code repo session (see §6b, §7).
- Change deployment config (Railway/Vercel env vars, `CORS_ORIGINS`, secrets) without SNA involved — these affect the live, shared deployment for everyone.
- Anything involving another client's PIN, password, or credentials — staff auth changes go through the admin flow in the app, not a repo prompt.

None of this is a hard technical lock (Claude Code *can* be asked to do most of these) — it's a "don't," to keep a mistake from reaching real client data or the live site without a second set of eyes.

---

## 9. Quick Reference

| Yash wants to... | Where he asks | What comes back |
| --- | --- | --- |
| Report something broken | Claude Code (web or live session) | Bug fix PR |
| Change how a screen looks/works | Claude Code | UI-change PR |
| Add a new capability | Claude Code | Scoped plan, then a PR |
| Change what data a record *type* stores | Claude Code | Backend + frontend PR |
| Fix one specific client's/record's data | App UI, or ask Harsh/Jash directly | Immediate data fix, no PR |
| Upload a client document | App UI (Visa module) | Stored immediately, no PR |
| Fix how uploads behave | Claude Code | Code-change PR |

---

<div align="center">

Questions about this doc → Harsh Shah

</div>

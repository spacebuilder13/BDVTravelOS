# Trip Planner + Compass AI Hub — Development Plan (POC → V1 → Expansion)

## 1) Objectives

- ✅ Make **Trip Planner the primary view** of `/app/ai`, with **floating service tabs** on top for **Compass AI Chat** and **Pins**.
- ✅ Deliver the **core workflow**: **Trip List → Trip Form → Map Builder → Legs & Stays → Quote Export (PDF)**.
- ✅ Implement **Leaflet + OSM tiles**, **Nominatim geocoding**, **Overpass layers (ON by default)** with **24h bbox caching**.
- ✅ Enforce mandatory fields in UX: **Origin, Dates, Child ages/DOB, Cancellation policies** (legs + stays) via required form validation and save-time enforcement.
- ✅ Ensure **Quote Export parity** inside Trip Planner:
  - ✅ Replicate **the exact tabs/fields** from the platform’s main quote builder (`QuoteBuilderModal.jsx` + sub-tabs).
  - ✅ Add **Smart Fill from Trip** to map data from planner **legs/stays/stops → quote items**.
- ✅ Reduce noise: fix **Overpass API error toasts** (log warnings only; no UI blocking).
- ✅ Fix **Sign-in page color scheme** (text visibility / contrast issues resolved).

### Security / Stability / Code Quality (Updated — Hardened)
- ✅ Backend: fix critical uninitialized variables on all code paths:
  - ✅ `data: dict = {}` initialised before JSON parsing in `POST /api/itinerary/ai-generate`
  - ✅ `_component_to_block()` initialises `block_type` + `data` defaults defensively
- ✅ Frontend: XSS hardening maintained:
  - ✅ `DOMPurify.sanitize()` used wherever `dangerouslySetInnerHTML` is required in `DocumentViewer.jsx`
- ✅ React hooks correctness:
  - ✅ Missing hook dependencies fixed across 8 high-traffic files
- ✅ Auth security upgrade:
  - ✅ Migrate auth token from `localStorage` to **httpOnly cookie** (backend + frontend)
  - ✅ Prevent infinite redirect loop on `/login` by guarding 401 interceptor redirects
- ✅ React stability:
  - ✅ Replace array-index keys with stable keys in key components
- ✅ Testing maintainability:
  - ✅ Split massive `backend_test.py` monolith tests into focused single-scenario test methods

---

### Objective Update — Compass AI Simplification (Delivered)
- ✅ **Remove Research & Capture from Compass AI page** (fully deleted, not hidden)
  - ✅ No Research/Capture UI components remain in CompassHub
  - ✅ Freed space reclaimed: Compass AI now runs **full-width**

---

### NEW Major Objective (Delivered): Unified Sidebar Trip Planner (3-pass consolidation)
- ✅ Consolidate **Trip Planner (Compass AI)** + **My Pins** + **Quotations** into a single unified **Trip Planner** sidebar section.
- ✅ Enforce constraints:
  - ✅ Use **Leaflet** (no Google iframes)
  - ✅ Do **not hardcode any tax rates** (taxes fetched from `/api/tax-profiles`)
  - ✅ Implement in **3 distinct passes** with approval gates (**Pass 1 complete, Pass 2 complete, Pass 3 complete**)

### NEW Objective (Delivered): Itinerary Handoff + Divergence Rule (Pass 3)
- ✅ For **Booked** trips, allow **Generate Itinerary** to convert `trip_components` into `itineraries.days[].blocks`.
- ✅ Enforce **Strict Divergence Rule**:
  - ✅ If an itinerary exists (`trip.linked_itinerary_id`), editing price-sensitive fields (`net_cost`, `sell_price`) must not silently save.
  - ✅ User must explicitly choose **Create Revised Quote** (flags divergence + saves change + opens Quote Drawer) or **Discard Change**.
- ✅ Generate Itinerary UX decision implemented per ask_human:
  - ✅ On click: ask if quotation is confirmed.
    - ✅ If **Yes** → generate itinerary + auto-navigate to **ItineraryDesigner**.
    - ✅ If **No** → prompt for quotation status update, set it, then stop.

---

### Objective Update — Trip Planner Map becomes operational routing map (Delivered)
- ✅ Replace static map behavior with a **live routing map**:
  - ✅ Each component with coordinates renders as a **numbered POI marker**
  - ✅ **Route lines** connect components in `sort_order`
  - ✅ **Directional arrows** shown per segment
  - ✅ Auto-fit bounds on component changes
  - ✅ No separate POI layers needed — components *are* the POI layer
- ✅ Component edit UX now supports location capture:
  - ✅ **Location search** via Nominatim in `ComponentEditModal`
  - ✅ Saves `latitude`/`longitude` onto `trip_components`

---

### Objective Update — Itinerary Designer × Compass AI integration (Delivered)
- ✅ Add **Compass AI Auto-Build** inside **ItineraryDesigner**:
  - ✅ Drawer UI allows **paste text** and/or **upload image**
  - ✅ Backend endpoint converts raw input into the **exact itinerary JSON structure** used by the Designer
  - ✅ Result loads into Designer as fully editable days/blocks

---

### Objective Update — Itinerary PDF Export upgraded to BDV client-ready format (Delivered)
- ✅ PDF export redesigned to match **Blue Diamond Voyage** example style:
  - ✅ Cover page branding
  - ✅ **Flights & Accommodation Summary** page (tables)
  - ✅ Improved day headers (DAY 01 + weekday + theme/date subtitle)
  - ✅ Closing company info page
- ✅ PDF retains operational usefulness:
  - ✅ Clickable links (Maps / Directions / `tel:`) where relevant

---

## 2) Implementation Steps

### Phase 1 — Core POC (Isolation, must pass before V1) ✅ COMPLETED
**Goal:** Prove map + Overpass + backend CRUD + PDF export work end-to-end with minimal UI.

**POC User Stories** ✅ Completed
1. ✅ Create a trip with required fields and see it listed.
2. ✅ Open a trip and add a stop with lat/lng.
3. ✅ View a Leaflet map and see Overpass POIs load for the current bbox.
4. ✅ Toggle to Compass Chat without losing context.
5. ✅ Export a basic branded PDF quote (initial implementation).

**Steps** ✅ Completed
- ✅ Backend verification (curl): create trip → add stop → add leg → add stay → validate → list pins.
- ✅ Frontend POC implemented inside `/app/ai` (now evolved into V1 CompassHub).
- ✅ Overpass bbox cache + throttling basics implemented.

---

### Phase 2 — V1 App Development (Build around proven core) ✅ COMPLETED
**Goal:** Turn POC into the integrated hub with the workflow and service tabs.

**V1 User Stories** ✅ Completed
1. ✅ Manage trips (create, edit, delete) and freely change status.
2. ✅ Trip Form required validations and clear prompts.
3. ✅ Build a route by adding stops and seeing them on the map.
4. ✅ Add legs/stays; **cancellation_policy required** on save; validation checks available.
5. ✅ Quote Export view + PDF generation UI entry point.

**Implemented (Key Deliverables)** ✅
- ✅ Route/UI structure:
  - `/app/ai` loads `CompassHub`.
  - Floating top service tabs: **Trip Planner (default)**, **Compass AI**, **Pins**.
  - Quick Access shortcuts panel (New Trip / Map Builder / Legs & Stays / Quote / Pins).
- ✅ Data layer:
  - `src/services/tripAPI.js` created for planner endpoints (trips/stops/legs/stays/pins/validate/full).
- ✅ Screens delivered:
  - Trip List
  - Trip Form
  - Map Builder
  - Legs & Stays
  - Quote Export
- ✅ Trip validation UX:
  - `/trips/{trip_id}/validate` checklist visible in Legs & Stays.

---

### Phase 3 — Quote Parity + Smart Fill + PDF Deep Validation ✅ COMPLETED
**Goal:** Achieve full feature parity and reliable client-facing output.

**Delivered** ✅
- ✅ Rebuilt `/app/frontend/src/components/planner/QuoteExport.jsx` to match platform quote builder structure:
  - ✅ Tabs: **Flights**, **Hotels**, **Tours & Transfers**, **Visa & Others**, **Markup & Tax**
  - ✅ Field parity by reusing platform components: `FlightTab`, `HotelTab`, `TourTransferTab`, `VisaOtherTab`
- ✅ Added **Smart Fill from Trip** mapping:
  - ✅ legs(mode=flight) → Flights
  - ✅ legs(mode!=flight) → Transfers
  - ✅ stays → Hotels
  - ✅ stop countries → Visa Fees
  - ✅ restaurants → Sightseeing/Misc (priced)
  - ✅ attractions → Sightseeing (priced)

**Testing** ✅
- ✅ iteration_20: QuoteExport (Frontend) 100% pass

---

### Phase 4 — UX Polish + Visual Consistency (Global UI/UX Audit) ✅ COMPLETED
**Goal:** Make the software look clean, aligned, professional, and consistent.

**Delivered** ✅
1. ✅ **Sign-in page contrast fixes**
2. ✅ **Tab alignment / layout polish**
3. ✅ **Overpass API toast noise reduction**
4. ✅ **Navigation bar cleanup**
5. ✅ **CompassHub nav bar text visibility fix**

---

### Phase 5 — Trip Planner: “Places” (Restaurants / Attractions / Tourist Info / Meeting Point) ✅ COMPLETED
**Goal:** Allow consultants to add destination-level POIs and ensure they reflect in Quote.

**Implementation** ✅
- ✅ Backend: CRUD endpoints + new collections for restaurants/attractions/info_points/meeting_points
- ✅ Frontend: `PlacesManager.jsx` with per-stop tabs and inline add/edit/delete
- ✅ Quote Integration: Smart Fill ingests restaurant + attraction costs into quote items
- ✅ Map: Route arrows shown between stops in `MapBuilder.jsx`

**Testing** ✅
- ✅ iteration_21: Places CRUD (Backend/Frontend) 100% pass

**Post-completion hardening (NEW, Completed)**
- ✅ Fix schema mismatch: make `stop_id`/`trip_id` optional in `RestaurantCreate`, `AttractionCreate`, `InfoPointCreate`, `MeetingPointCreate`
  - Reason: stop_id/trip_id come from URL path params; requiring them in the request body caused 422 errors in clone and other flows

---

### Phase 6 — Clone Itinerary / Duplicate Day Feature ✅ COMPLETED (P1)
**Goal:** Rapidly duplicate an existing trip into a fully independent copy including all nested planner data.

**Delivered** ✅
- ✅ Backend: `POST /api/trips/{trip_id}/clone` deep-copy trip tree with ID remapping
- ✅ Frontend: Clone button in Trip lists (TripList + CompassHub)

**Testing** ✅
- ✅ iteration_22: clone endpoint tests 100% pass (historical)
- ✅ iteration_33: clone endpoint now re-verified; nested-entity cloning validated after schema fix

---

### Phase 7 — QuoteExport jsPDF Manual Layout Validation + Fixes ✅ COMPLETED (P1)
**Goal:** Ensure QuoteExport PDF generation is robust for heavily populated quotes.

**Fixes Implemented** ✅
- ✅ Dynamic heights for summary + wrapped travel details
- ✅ Multi-line rows for Hotels / Tours / Visa sections

---

### Phase 8 — Code Quality / Security Hardening ✅ COMPLETED (Expanded)
**Goal:** Remove critical security risks and stabilize runtime.

**Delivered** ✅
- ✅ Backend: fix uninitialized variables (AI generate + component-to-block conversion)
- ✅ Frontend: DOMPurify sanitization for any HTML rendering in DocumentViewer
- ✅ Hooks: fix missing dependencies + stabilize callbacks in large components
- ✅ Auth migration: move JWT storage to httpOnly cookie
  - ✅ Backend: `/auth/login` sets cookie; `/auth/logout` clears cookie
  - ✅ Backend: `get_current_user` supports cookie OR Bearer token (backward compatibility)
  - ✅ Frontend: `AuthContext` validates session via `/auth/me`
  - ✅ Frontend: axios/fetch calls use credentials/withCredentials
  - ✅ Frontend: prevent infinite redirect loop on `/login` via 401 redirect guard
- ✅ React warnings: replace index keys with stable keys in Settings, QuoteBuilderModal, LeadsTable
- ✅ Backend tests: split complex test methods into focused single-scenario tests

**Bonus Fixes (During Testing)** ✅
- ✅ Fix multi-currency quote 500 error: handle `None` gst_rate/tcs_rate in totals computation (`or 0` fallback)

**Testing** ✅
- ✅ iteration_33: backend auth cookie + itinerary CRUD + quote export verified

---

### Phase 9 — Browser → Research & Capture Tool ✅ COMPLETED (P1)
**Goal:** Rework Browser into a **research + evidence capture** workflow.

✅ **Note:** This phase is historically completed, but the **Compass AI page no longer surfaces Research & Capture** per latest requirement (see Phase 12).

(Implementation details unchanged; see prior versions for full checklist.)

---

### Phase 10 — NEW MAJOR REWORK: Sidebar “Trip Planner” merge + unified data model (3 Passes) ✅ COMPLETED
**Goal:** Merge three existing features into one sidebar section called **Trip Planner**.

#### Pass 1 — Data model + migration only ✅ COMPLETED
- ✅ Canonical collections: `trip_components`, `places`, `tax_profiles`, `quote_terms_template`
- ✅ Trip status enum normalized (7 stages)
- ✅ Migration runner and idempotency
- ✅ iteration_27: backend migration suite 24/24 pass

#### Pass 2 — Planner Canvas + Quote Drawer + Sidebar changes ✅ COMPLETED
- ✅ Trip list (Screen 1) + Canvas (Screen 2) + Quote Drawer (Screen 3)
- ✅ Reorder endpoint integrated
- ✅ CompassHub cleaned to 2-pane (later superseded by Phase 12 full-width)

#### Pass 3 — Itinerary handoff + divergence rule ✅ COMPLETED + TESTED
- ✅ `POST /api/trips/{trip_id}/generate-itinerary`
- ✅ `PATCH /api/trips/{trip_id}/divergence`
- ✅ Divergence dialog + banner + revised quote CTA
- ✅ iteration_29: 100% pass

---

### Phase 11 — Itinerary PDF Export: clickable links + parity fixes ✅ COMPLETED
**Goal:** Ensure itinerary PDF export matches the ItineraryDesigner structure and includes clickable operational links.

**Delivered** ✅
- ✅ Clickable Maps / Directions / `tel:` links per block
- ✅ INFO content included
- ✅ Improved page-break estimation
- ✅ iteration_30: 100% pass

---

### Phase 12 — Compass AI cleanup + ItineraryDesigner AI Auto-Build + BDV PDF Redesign ✅ COMPLETED

#### 12.1 Compass AI page — remove Research & Capture ✅
- ✅ `CompassHub.jsx` rewritten: now renders **only** `AIAssistant` full-width
- ✅ No Research/Capture UI components, routes, or menu entries in CompassHub

#### 12.2 Itinerary Designer × Compass AI integration ✅
- ✅ Backend: `POST /api/itinerary/ai-generate`
  - ✅ Accepts: `text_input`, `image_b64`, `image_mime_type`, `linked_quote_id`, `existing_meta`
  - ✅ Uses Emergent LLM key + Anthropic model for generation
  - ✅ Strips code fences and parses JSON (defensive initialisation prevents crashes)
  - ✅ Adds IDs to blocks if missing
  - ✅ Timeout guard: returns **504** with actionable message if AI call exceeds threshold
- ✅ Frontend: ItineraryDesigner drawer
  - ✅ Toolbar button: **AI Build**
  - ✅ Drawer supports paste text + upload image
  - ✅ Generated itinerary loads into Designer and remains fully editable

#### 12.3 PDF output — match BDV example ✅
- ✅ `generatePDF()` updated:
  - ✅ Cover page branding (BDV)
  - ✅ Flights & Accommodation Summary page (tables) when FLIGHT/HOTEL blocks exist
  - ✅ Improved day headers: `DAY 01 · WEEKDAY` plus date/theme subtitle
  - ✅ Closing company info page

**Testing** ✅
- ✅ Frontend checks (drawer + CompassHub) passed historically
- ✅ Backend endpoint verified structurally + model/provider corrected

---

## 3) Next Actions

1. **OneDrive Integration (Blocked)**
   - Request Azure `Application (client) ID` and `Directory (tenant) ID`
2. **Clone/Duplicate Day (Optional P2)**
   - Currently only full-trip cloning exists
3. **Optional Expansion: Sources for additional entities (P2)**
   - Add attach-source support for Places and Quote items if needed
4. **Periodic QA: PDF Visual Review (High Value)**
   - Compare BDV PDF export against real client examples (spacing, typography, logo placement)
   - Validate long itineraries (many blocks) for page-break correctness
5. **Security follow-up (Recommended)**
   - Consider setting cookie attributes via env (Secure/SameSite) for local dev vs prod
   - Add CSRF strategy if cross-site embedding is expected (SameSite=Lax is currently the main mitigation)

---

## 4) Success Criteria

- ✅ `/app/ai` opens to Trip Planner main view with floating tabs to Compass AI + Pins.
- ✅ Quote export provides full platform parity and Smart Fill works.
- ✅ Login page is readable and visually consistent.
- ✅ Overpass errors do not spam toasts.
- ✅ Trip Planner supports Places and those costs reflect in QuoteExport.
- ✅ Trip cloning works end-to-end.
- ✅ PDF export handles long content.
- ✅ Compass AI loads and streams responses.
- ✅ Code quality issues from report resolved:
  - ✅ Backend uninitialized variables fixed
  - ✅ Frontend XSS sanitization present
  - ✅ Hook dependency warnings addressed in key files
  - ✅ Auth tokens no longer stored in localStorage (httpOnly cookie)
  - ✅ Array-index keys removed from key lists
  - ✅ Backend tests split into focused methods

**Phase 10 Success Criteria (Met)**
- ✅ Pass 1: Canonical collections + migration runner + idempotency
- ✅ Pass 2: New Trip Planner screens + drawer + sidebar
- ✅ Pass 3: Itinerary handoff + divergence rule (iteration_29)

**Phase 11 Success Criteria (Met)**
- ✅ Day-wise PDF export from ItineraryDesigner
- ✅ Clickable operational links
- ✅ Correct page-break logic

**Phase 12 Success Criteria (Met)**
- ✅ CompassHub contains no Research/Capture and uses full-width layout
- ✅ ItineraryDesigner can auto-build from text or image input
- ✅ PDF export matches BDV example structure (cover + summary + day pages + closing)

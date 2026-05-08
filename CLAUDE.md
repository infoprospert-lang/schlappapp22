# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Express + Vite HMR via tsx server.ts)
npm run build        # Production build (Vite)
npm start            # Run production server (NODE_ENV=production tsx server.ts)
npm run lint         # TypeScript type checking (tsc --noEmit)
npm run clean        # Remove dist/
```

No test suite is configured.

## Environment Setup

Copy `.env.example` to `.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Required — Google Gemini AI |
| `APP_URL` | Hosting URL for self-referential links |
| `WEBHOOK_URL` | n8n webhook triggered on job completion |
| `RESEND_API_KEY` | Email delivery (preferred over SMTP) |
| `OFFICE_EMAIL` | Recipient for job summary emails |
| `SMTP_*` | Fallback email config if no Resend key |

## Architecture

This is a full-stack towing/roadside-assistance documentation app called **AppSchleppen**, serving two companies (Auto-Misselwitz GmbH, Swientek & Gläser GmbH). The UI is entirely in German and optimized for tablets (max-width 768px).

### Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS 4 + Motion.js, bundled by Vite
- **Backend:** Express.js served from `server.ts`, which also serves the Vite-built frontend in production
- **Database:** SQLite via `better-sqlite3` (four tables: `jobs`, `files`, `drivers`, `vehicles`)
- **PDFs:** `pdfGenerator.ts` produces GDPR/order/liability documents using PDFKit
- **Email:** Resend SDK (falls back to Nodemailer/SMTP)
- **Exports:** Job data + photos + PDFs zipped via `archiver` and sent to the n8n webhook

### Request Lifecycle

1. Driver selects company → job object created via `mkState()`, synced to SQLite on every change
2. Each screen mutation calls `upd()` → triggers `sync()` → `POST /api/jobs`
3. On completion: `POST /api/jobs/:id/complete` → PDFs generated → ZIP assembled → webhook POST → email sent → upload files cleaned up from disk

### Key Files

| File | Role |
|---|---|
| `src/App.tsx` | Entire frontend — all screens as named functions inside one file (~1 575 lines) |
| `src/components/SignaturePad.tsx` | Canvas-based signature capture (the only split-out component) |
| `server.ts` | All Express routes + SQLite schema + multer file handling (~508 lines) |
| `pdfGenerator.ts` | Generates three legal PDFs (Datenschutzerklärung, Auftragsbestätigung, Haftungsausschluss) |

### Frontend Screens (in navigation order)

`Login` → `Dashboard` → `Basics` → `Detail` → `Service` → `Destination` → `Presence` → `Docs` → `Damages` → `Sigs` → `Notes` → `Summary` → `Admin`

All screens are functions defined inside `App.tsx`. State lives in the root `App` component and is passed down via props.

### State & Data Patterns

- **Central state:** `JobState` object holds all job data. `upd(partial)` merges changes and triggers backend sync.
- **localStorage keys:** `selected_company`, `selected_driver`, `selected_vehicle`, `current_job_id`, `admin_pw`
- **Static lookup tables** in `App.tsx`: `COMPANIES`, `FIXED_DESTINATIONS` (drivers/vehicles are now DB-driven, fetched from `/api/drivers` and `/api/vehicles`)
- **File uploads:** Multer stores to `/uploads/<jobId>/`, keyed by field name via `FILE_LABELS`
- **Job restoration:** On app mount, if `current_job_id` is in localStorage and the job is not completed, the full `JobState` is restored from the server.

### Master Data API (drivers & vehicles)

Managed via Admin → Stammdaten tab. Soft-delete (sets `active=0`) preserves historical references.

| Route | Purpose |
|---|---|
| `GET /api/drivers` | Active drivers (add `?all=1` for all incl. inactive) |
| `POST /api/drivers` | Create driver `{name}` |
| `PUT /api/drivers/:id` | Update driver `{name, active}` |
| `DELETE /api/drivers/:id` | Deactivate driver |
| `GET /api/vehicles` | Active vehicles (add `?all=1` for all) |
| `POST /api/vehicles` | Create vehicle `{label, plate}` |
| `PUT /api/vehicles/:id` | Update vehicle `{label, plate, active}` |
| `DELETE /api/vehicles/:id` | Deactivate vehicle |

On first startup, both tables are seeded from the previously hardcoded lists (idempotent guard: only inserts when `COUNT(*) = 0`).

### Documentation flow (statusIndex)

| si | Status | Modules visible? |
|---|---|---|
| 0 | Angenommen | No (locked) |
| 1 | Auf dem Weg | No (locked) |
| 2 | Ankunft | No — "DOKUMENTATION STARTEN" CTA shown |
| 3 | Dokumentation | **Yes** — modules unlocked after clicking the CTA |
| 4 | Transport | Yes |
| 5 | Abgeschlossen | Yes |

`unlocked = si >= 3`. Modules are only accessible after "DOKUMENTATION STARTEN" is explicitly clicked.

### Photo data model

Photos in `JobState.photos` are stored as `PhotoEntry[]` objects: `{url: string, note: string}`. Old jobs with plain-string URLs are handled by `photoUrl(p)` / `photoNote(p)` helpers defined just above the Helpers section. Always use these helpers when reading photo entries. Pre-damage photos in `preDamages[cat].photos` remain `string[]` — they are separate and unchanged.

### Photo requirements

`isSevereAccident` does **not** reduce required photos. Severe-accident checkbox only skips the plateau photo (vehicle can't safely be loaded). All other photos (arrival, plate, cockpit, front, right, left, rear) remain mandatory. For `notoeffnung` only `arrival` and `plate` are required — this is the only service-type exception.

### Styling Conventions

Tailwind CSS with shared class-string constants defined at the top of `App.tsx`:

```ts
const PRIMARY = "bg-[#FF6321] text-white ..."
const CARD    = "bg-white rounded-[28px] ..."
const INPUT   = "border rounded-[12px] ..."
// etc.
```

Always reuse these tokens rather than inlining new color/radius values.

### Deployment

Configured for Railway (`railway.toml`). Build: `npm run build`. Start: `npm start`. Uploads directory must be writable at runtime.

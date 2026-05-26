# Obsidian Prospect Engine

Internal lead generation app for **Obsidian Systems LLC**. Finds local businesses with weak online presence (no website, broken site, Facebook-only, outdated site) and scores them for website development outreach.

This version includes private access with super-admin account controls and email invite onboarding.

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- Prisma + PostgreSQL
- Google Places API (New) — legal API usage, no scraping
- Cookie-based authentication (JWT signed with `SESSION_SECRET`)
- Resend invite email flow

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and set:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `SESSION_SECRET` | Yes | Signs secure auth session cookie (32+ chars) |
| `APP_URL` | Yes | Public app URL used in invite links |
| `GOOGLE_PLACES_API_KEY` | Yes | Places Text Search + Geocoding |
| `RESEND_API_KEY` | Yes | Sends invite emails from super-admin panel |
| `RESEND_FROM_EMAIL` | Yes | Verified sender identity in Resend |
| `OPENAI_API_KEY` | No | Future AI outreach drafts |

### 3. Set up the database

```bash
npm run db:push
npm run db:seed
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Access Control & Onboarding Flow

- App is private by default (middleware blocks public access).
- Super admin email is fixed to:
  - `isaac.rutledgev@obsidian-systems.tech`
- Seed creates super admin with a random password and `mustChangePassword = true`.
- On first login, super admin is forced to change password.
- Super admin can invite users from `/admin/invites`.
- Invite flow:
  1. Super admin enters email.
  2. Invite email is sent through Resend.
  3. Invitee clicks **Authorize my email**.
  4. App marks email authorized.
  5. Invitee is redirected to set password.
  6. Invitee logs in and accesses internal app.

## Google Places API

1. Create a Google Cloud project
2. Enable **Places API (New)** and **Geocoding API**
3. Create an API key (restrict to those APIs in production)
4. Add to `.env` as `GOOGLE_PLACES_API_KEY`

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard stats |
| `/search` | Lead search form |
| `/results` | Latest search results |
| `/leads` | Saved leads / CRM |
| `/leads/[id]` | Lead detail, audit, outreach |
| `/campaigns` | Campaign list |
| `/settings` | Env & API setup guide |
| `/admin/invites` | Super admin invite management |
| `/login` | Sign in |
| `/change-password` | Forced or manual password update |
| `/invite/[token]` | Invite authorization screen |
| `/setup-password` | New invited user password setup |

## API Routes

- `POST /api/search-leads` — Google Places search + website audit
- `POST /api/audit-website` — Re-run website classification
- `POST /api/save-lead` — Persist lead to database
- `GET /api/leads` — List leads (filters: status, minScore, q)
- `GET/PATCH /api/leads/[id]` — Lead detail / update
- `POST /api/generate-outreach-draft` — Placeholder outreach message
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Current session user
- `POST /api/auth/change-password` — Change current user password
- `POST /api/auth/setup-password` — Set invited user password
- `POST /api/invite/accept` — Authorize invited email by token
- `GET/POST /api/admin/invites` — Super admin invite management

## Lead Scoring

| Condition | Score |
|-----------|-------|
| No website | 100 |
| Facebook only | 90 |
| Broken website | 85 |
| Non-HTTPS | 75 |
| Outdated site | 70 |
| Modern website | 20 |

## License

Private — Obsidian Systems LLC internal use.

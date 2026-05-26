# Obsidian Prospect Engine

Internal lead generation app for **Obsidian Systems LLC**. Finds local businesses with weak online presence (no website, broken site, Facebook-only, outdated site) and scores them for website development outreach.

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- Prisma + PostgreSQL
- Google Places API (New) — legal API usage, no scraping

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
| `GOOGLE_PLACES_API_KEY` | Yes | Places Text Search + Geocoding |
| `OPENAI_API_KEY` | No | Future AI outreach drafts |

### 3. Set up the database

```bash
npm run db:push
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

## API Routes

- `POST /api/search-leads` — Google Places search + website audit
- `POST /api/audit-website` — Re-run website classification
- `POST /api/save-lead` — Persist lead to database
- `GET /api/leads` — List leads (filters: status, minScore, q)
- `GET/PATCH /api/leads/[id]` — Lead detail / update
- `POST /api/generate-outreach-draft` — Placeholder outreach message

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

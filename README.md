# ExoLens

Interactive explorer for confirmed exoplanets on a log–log mass × orbital-period
chart, backed by a weekly NASA catalog snapshot and a constrained AI readout.

**[Open the live app →](https://exoplanet-analytics.vercel.app/)**

> The API runs on Render’s free tier. The first request after idle can take a
> few seconds while the instance wakes up.

![ExoLens desktop dashboard with Kepler-22 b selected](docs/exoplanet-analytics-desktop.jpg)

## What it does

- Plot **6,000+** confirmed planets from the NASA Exoplanet Archive
- Search or click a planet to inspect mass (Earth masses) and orbital period (days)
- Zoom / pan a dense log–log field with Earth and Jupiter as reference anchors
- Generate a short AI interpretation from **only** those two measured values

AI output is an educational summary, not a scientific assessment. The prompt
forbids temperature, atmosphere, climate, host-star, and habitability claims.

## Design decisions

These are the choices the project is built around:

| Choice | Why |
| --- | --- |
| Checked-in `planets.json` snapshot | Chart loads stay fast and offline-from-NASA. Request path never depends on TAP latency. |
| Weekly GitHub Actions refresh | Catalog freshness without coupling UX to a live upstream query. |
| AI limited to mass + period | Prevents the model from inventing properties the UI did not supply. |
| OpenAI key only on the API | Browser never sees the secret; frontend only posts a planet name. |
| In-memory rate limit (15/IP/hour) | Cheap guard for a small public demo—not distributed rate limiting. |

## Architecture

```text
NASA Exoplanet Archive (pscomppars)
          │
          │ weekly TAP query (GitHub Actions)
          ▼
refresh_planets.py ── clean + dedupe ──► api/planets.json
                                                │
React + Plotly ◄──────── GET /planets ──── FastAPI (mtime-cached)
      │                                       │
      └────────────── POST /analyze ──────────┤
                                              ▼
                                     OpenAI GPT-4o mini
```

### Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Plotly.js |
| API | FastAPI, pandas |
| AI | OpenAI GPT-4o mini |
| Pipeline | NASA TAP, requests, pandas, GitHub Actions |
| Hosting | Vercel (frontend), Render (API) |

## Run locally

**Prerequisites:** Python 3.13, Node.js 22, and an OpenAI API key only if you
want AI interpretation.

### 1. API

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt
cp api/.env.example api/.env
uvicorn api.main:app --reload --reload-dir api --port 8000
```

- Catalog: `http://localhost:8000/planets`
- Docs: `http://localhost:8000/docs`

The chart works without `OPENAI_API_KEY`. Set it in `api/.env` to enable
**Generate interpretation**.

### 2. Frontend

```bash
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Local Vite proxies
`/planets` and `/analyze`, so `VITE_API_URL` can stay unset.

## Configuration

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | API | unset | Enables `/analyze` |
| `CORS_ORIGINS` | API | local Vite origins | Allowed browser origins |
| `VITE_API_URL` | Frontend | unset in local dev | Public API origin, baked in at build time |

```bash
cp api/.env.example api/.env
cp frontend/.env.example frontend/.env
```

Never put `OPENAI_API_KEY` in the frontend. `VITE_` variables are shipped to
the browser.

## API

### `GET /planets`

```json
[
  {
    "pl_name": "11 Com b",
    "pl_bmasse": 4914.89849,
    "pl_orbper": 323.21
  }
]
```

### `POST /analyze`

```json
{ "selectedPlanet": "11 Com b" }
```

Returns a two-sentence mass and orbit interpretation. Limited to 15 requests
per IP per rolling hour (in-memory; process-local).

## Data

Refresh queries NASA’s
[Planetary Systems Composite Parameters (`pscomppars`)](https://exoplanetarchive.ipac.caltech.edu/docs/API_PSCompPars_columns.html):

```sql
SELECT pl_name, pl_bmasse, pl_orbper
FROM pscomppars
```

| Field | Meaning |
| --- | --- |
| `pl_name` | Planet name |
| `pl_bmasse` | Mass or mass × sin(i), Earth masses |
| `pl_orbper` | Orbital period, days |

`pscomppars` stores one composite row per planet and can pick the best
reference **independently per field**, so a planet’s mass and period may come
from different publications. The refresh script drops rows missing mass or
period and deduplicates by name into `api/planets.json`.

```bash
source .venv/bin/activate
python scripts/refresh_planets.py
```

The [scheduled workflow](.github/workflows/refresh-planets.yml) runs Mondays at
16:00 UTC and commits when the catalog changes.

## Project structure

```text
api/
├── main.py                 # routes, catalog cache, OpenAI call, rate limit
├── planets.json            # generated snapshot
└── requirements.txt
frontend/
├── src/                    # React UI + Plotly chart
└── package.json
docs/
└── exoplanet-analytics-desktop.jpg
scripts/
└── refresh_planets.py      # NASA TAP ingestion
.github/workflows/
└── refresh-planets.yml     # weekly refresh
```

## Production

| Service | Variable | Value |
| --- | --- | --- |
| Render | `OPENAI_API_KEY` | Server-side secret |
| Render | `CORS_ORIGINS` | `https://exoplanet-analytics.vercel.app` |
| Vercel | `VITE_API_URL` | `https://exoplanet-api-rpsl.onrender.com` |

Set `VITE_API_URL` before the frontend build—Vite embeds it at build time.

## Data credit

Catalog data from the
[NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/), operated
by Caltech under contract with NASA.

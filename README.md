# India Startup Ecosystem Intelligence Platform

A centralized ecosystem intelligence database and visual dashboard of Indian startup incubators, accelerators, startups, mentors, investors, government schemes, and their relationships. 

The platform features an automated data pipeline for crawling, cleaning, entity resolution (deduplication), and AI-driven enrichment (with optional Google Gemini API support), exporting to CSV, JSON, MongoDB, or Neo4j Cypher scripts.

## Platform Architecture

- **Backend (Python FastAPI)**: Manages SQLite local caching, executes the processing pipelines, handles entity resolution string distances, triggers AI tags/geocodes, and serves REST APIs.
- **Frontend (React + Vite + Vanilla CSS)**: Provides a visually stunning cyberpunk dark-mode dashboard using glassmorphism, rendering aggregated metrics, lists with advanced filter criteria, and a high-performance 2D physics canvas-based force-directed knowledge graph.

```
/
├── backend/
│   ├── app/
│   │   ├── database.py       # SQLite database schema, initialization, and logs
│   │   ├── scraper.py        # Seed dataset scraper & crawler simulator
│   │   ├── cleaner.py        # Normalization rules (states, cities, emails, urls)
│   │   ├── resolution.py     # Entity resolution deduplication (Jaccard, Acronyms)
│   │   ├── enricher.py       # Geolocation coordinates mapping & Gemini API enrichment
│   │   ├── graph.py          # Node-link generators & multi-db export format builders
│   │   └── main.py           # FastAPI routes & download streaming endpoints
│   ├── run.py                # Server runner
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnalyticsDashboard.jsx  # Metrics, graphs, and SVG/CSS visual reports
│   │   │   ├── DirectoryView.jsx       # Advanced filterable grid and detail drawers
│   │   │   ├── GraphVisualizer.jsx     # Zoomable physics force-directed graph
│   │   │   ├── PipelineControl.jsx     # Pipeline triggers and log terminal output
│   │   │   └── ExporterPanel.jsx       # Downloads panel (CSV, JSON, Mongo, Neo4j)
│   │   ├── App.jsx           # Sidebar shell, API state hooks, offline fallback
│   │   └── index.css         # Glassmorphism design token tokens
│   └── package.json
└── README.md
```

---

## Getting Started

### 1. Launch the Python FastAPI Backend

Open a terminal window and execute:

```bash
# Navigate to backend and install dependencies
cd backend
pip install -r requirements.txt

# Run the backend FastAPI server (runs on port 8000)
python run.py
```

### 2. Launch the React Vite Frontend

Open a second terminal window and execute:

```bash
# Navigate to frontend
cd frontend

# Install package dependencies
npm install

# Run Vite dev server (runs on port 5173)
npm run dev
```

Open `http://localhost:5173` in your web browser to access the dashboard.

---

## Docker Quick Start

For a self-contained local installation, the client only needs Git and Docker Desktop. MongoDB and Redis are included in the stack, so no account, database installation, or environment file is required.

```bash
git clone https://github.com/cantrachme/InCubein.git
cd InCubein
docker compose build
docker compose up
```

Open `http://localhost:8000`. The health endpoint is available at `http://localhost:8000/health`.

The stack contains **nginx** (serves the React app and proxies `/api`), **FastAPI**, **Redis**, and **MongoDB**.

```
docker-compose.yml
├── frontend/   # nginx:1.27-alpine -> built SPA + /api proxy
├── backend/    # python:3.11-slim  -> FastAPI (uvicorn :8000)
├── redis       # redis:7-alpine     -> AOF persistence, healthchecked
└── mongo       # local persistent MongoDB
```

### Optional integrations

The dashboard starts without third-party credentials. To enable email, Google Calendar, or AI providers, copy `backend/.env.example` to `backend/.env` and add the required values. To change the website port or use a managed MongoDB deployment, copy the root `.env.example` to `.env` and update `PORT` or `MONGO_URI` there.

**Production notes:**
- Set `GOOGLE_REDIRECT_URI` to your public URL, e.g. `https://your-domain/api/outreach/oauth2callback`.
- `backend/.env` and root `.env` are gitignored — never commit secrets.
- In real production put a TLS-terminating reverse proxy (nginx/caddy/Traefik/cloud LB) in front of `PORT`.

### Running and stopping

```bash
docker compose build
docker compose up

# Check status + logs
docker compose ps
docker compose logs -f backend frontend redis mongo
```

The app is served at `http://localhost:8000` by default, or the `PORT` configured in a root `.env` file.

### Updates and maintenance

```bash
docker compose build && docker compose up -d          # deploy new code
docker compose down                                    # stop (keeps volumes)
docker compose down -v                                 # stop + wipe redis/data volumes
```

Persistent data lives in named volumes: `mongo-data`, `redis-data`, `scratch-data` (email logs), `attachments-data` (template files), and `token-data` (Google OAuth token).

### Redis usage

The backend includes `backend/app/core/redis.py` with lazy-connect helpers (`cache_get` / `cache_set` / `cache_delete` / `invalidate`) that degrade to no-ops when Redis is unavailable, so the app keeps working without it. `REDIS_URL` defaults to `redis://localhost:6379/0` in dev and is set automatically to the `redis` service by docker-compose.

---

## Ingestion Pipeline Phases

Through the **Pipeline Control** tab on the dashboard, you can trigger the stages of the pipeline:

1. **Scraping**: Loads raw, unstructured data containing typos, state abbreviations, invalid emails, and duplicate entries.
2. **Cleaning**: Standardizes states (e.g. `MH` → `Maharashtra`), normalizes cities (e.g. `Bombay` → `Mumbai`), validates emails, and formats URLs with `https://`.
3. **Entity Resolution**: Merges duplicate records (e.g. merging `SINE IIT Bombay` and `Society for Innovation and Entrepreneurship IIT Bombay`), updates their portfolio links, and fixes relationships.
4. **AI Enrichment**: Fills in missing fields. Performs local keyword classification for focus sectors, geocodes cities, and integrates with **Google Gemini API** (if a `GEMINI_API_KEY` environment variable is supplied) to perform semantic summarization and sector tagging.

---

## Supported Export Formats

In the **Downloads & Export** tab, download:
- **Zipped CSV Archive**: Generates `incubators.csv`, `startups.csv`, `mentors.csv`, `investors.csv`, and `relationships.csv`.
- **Ecosystem JSON**: Single hierarchical JSON of all entities.
- **MongoDB Collection script**: Collection insert script for document storage.
- **Neo4j Cypher query script**: Cypher queries creating unique constraints, merging nodes, and creating directed relationship edges.

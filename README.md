# GeoMind AI

GeoMind AI is a hackathon-ready full-stack land intelligence platform for uploading property records, extracting land metadata with AI-style agents, matching that data against GIS parcels, detecting ownership and boundary conflicts, visualizing risk on a map, and generating downloadable reports.

## Gemini + Vertex AI

GeoMind AI now includes a centralized Gemini service layer with optional Vertex AI mode.

- `backend/app/services/ai_service.py` is the single integration point for Gemini and Vertex AI.
- Set `GOOGLE_GENAI_USE_VERTEXAI=true` to route requests through Vertex AI.
- Set `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and optionally `GOOGLE_APPLICATION_CREDENTIALS` for Vertex AI authentication.
- If `GOOGLE_GENAI_USE_VERTEXAI=false`, the backend uses the direct Gemini API key from `GEMINI_API_KEY`.
- Streaming conversational responses are available on `POST /ai/chat/stream`.
- Agent execution traces are persisted and available at `GET /ai/agent-logs`.

### Backend AI capabilities

- Gemini-powered structured document extraction
- pgvector-backed document chunk indexing with Gemini embeddings
- Gemini-powered risk and report generation
- Conversational GIS querying grounded in parcel context
- Streaming chat responses for the frontend
- Persistent agent execution logs

## What’s Included

- React + Tailwind frontend with:
  - Login and registration
  - Executive dashboard
  - Document upload and analysis flow
  - Interactive Leaflet parcel map
  - AI chat workspace
  - Reports and property detail pages
  - Admin panel with GeoServer layer metadata
- FastAPI backend with:
  - JWT auth and role support
  - Document upload APIs
  - Property extraction pipeline
  - GIS parcel matching and conflict detection
  - Risk analysis and PDF report generation
  - GeoServer URL publishing helpers
- PostgreSQL/PostGIS schema and seed parcels
- Docker Compose for frontend, backend, database, pgAdmin, and GeoServer
- Demo sample file in [demo/sample-land-record.txt](/c:/docker-workspace/geomaind/demo/sample-land-record.txt)

## Architecture

### AI Agent Flow

1. `Planner Agent` decides the analysis path.
2. `Document Agent` extracts owner, khasra number, village, district, area, date, and document chunks.
3. `GIS Agent` matches document entities with `land_parcels`.
4. `Conflict Agent` checks:
   - duplicate khasra numbers
   - ownership mismatches
   - area differences
   - parcel intersections via `ST_Intersects`
5. `Risk Agent` assigns a risk score and severity.
6. `Report Agent` creates a structured report and downloadable PDF.
7. `Chat Agent` answers follow-up questions with document citations.

### Core Stack

- Frontend: React, Tailwind CSS, Leaflet, Axios, React Router, Framer Motion
- Backend: FastAPI, SQLAlchemy, PostGIS, GeoAlchemy2, ReportLab
- AI/RAG layer: Gemini embeddings, pgvector retrieval, document chunking
- GIS: PostGIS + GeoServer-ready WMS/WFS integration helpers

## Project Structure

```text
geomaind/
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   ├── core/
│   │   ├── db/
│   │   └── services/
│   ├── sql/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/components/
│   ├── src/pages/
│   ├── src/state/
│   └── Dockerfile
├── demo/
├── docker-compose.yml
├── .env.example
└── README.md
```

## Database Schema

Tables included in the backend model layer:

- `users`
- `uploaded_documents`
- `extracted_property_data`
- `land_parcels`
- `property_matches`
- `conflict_reports`
- `ai_reports`
- `chat_history`
- `document_chunks`

`document_chunks` stores chunk text, citation labels, and pgvector embeddings for semantic retrieval during chat and downstream analysis.

`land_parcels` includes parcel geometry and is seeded with:

- duplicate/conflicting khasra records
- clean records
- medium-risk records
- overlapping parcel polygons

## API Endpoints

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Dashboard

- `GET /dashboard/summary`

### Documents

- `POST /documents/upload`
- `GET /documents`
- `GET /documents/{id}`

### AI

- `POST /ai/analyze-document/{document_id}`
- `POST /ai/chat`
- `POST /ai/chat/stream`
- `POST /ai/generate-report/{property_id}`
- `GET /ai/agent-logs`

### GIS

- `GET /gis/parcels`
- `GET /gis/parcels/{id}`
- `GET /gis/search?khasra=`
- `POST /gis/match-property?property_id=`
- `GET /gis/conflicts/{property_id}`
- `GET /gis/geoserver/publish`
- `GET /gis/geoserver/layers`

### Reports

- `GET /reports`
- `GET /reports/{id}`
- `GET /reports/{id}/download`

## Local Run

1. Copy `.env.example` values if you want to customize environment settings.
2. Start the stack:

```bash
docker compose up --build
```

3. Open:
   - Frontend: `http://localhost:5173`
   - Backend docs: `http://localhost:8000/docs`
   - pgAdmin: `http://localhost:5050`
   - GeoServer: `http://localhost:8084`

4. pgAdmin login:
   - Email: `admin@geomind.ai` or `PGADMIN_DEFAULT_EMAIL`
   - Password: `admin123` or `PGADMIN_DEFAULT_PASSWORD`

5. To register the GeoMind database inside pgAdmin, use:
   - Host: `db`
   - Port: `5432`
   - Database: `geomind`
   - Username: `geomind`
   - Password: `geomind`

## Demo Credentials

- Admin: `admin@geomind.ai` / `admin123`
- Analyst: `analyst@geomind.ai` / `analyst123`
- User: `user@geomind.ai` / `user123`

## Hackathon Demo Flow

1. Sign in as admin.
2. Open `Upload Document`.
3. Upload [demo/sample-land-record.txt](/c:/docker-workspace/geomaind/demo/sample-land-record.txt) or a PDF with similar fields.
4. Let the agent pipeline run.
5. Review the extracted land metadata and risk score.
6. Open `Map Intelligence` to inspect highlighted parcels.
7. Ask in `AI Chat`: `Why is this property high risk?`
8. Open `Reports` and download the generated PDF.

## Notes

- The code is structured so Gemini, LangChain, or a richer RAG layer can be swapped in later.
- The current extraction pipeline is heuristics-first for hackathon reliability and demo speed.
- GeoServer integration is represented by publish metadata and WMS/WFS URLs so the frontend can consume those layers next.

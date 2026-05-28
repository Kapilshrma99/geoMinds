# GeoMind AI

GeoMind AI is a hackathon-ready land intelligence platform built for the Google Cloud Rapid Agent Hackathon. It combines FastAPI, React, PostGIS, GeoServer, Gemini/Vertex AI, and a MongoDB MCP-backed precedent store to analyze land documents, validate parcels, explain conflicts, and generate risk reports.

## Hackathon Positioning

- Built for the Google Cloud Rapid Agent Hackathon
- Powered by Gemini and Vertex AI
- Orchestrated as a Google Cloud Agent Builder workflow
- Uses MongoDB MCP as the required partner integration
- Uses PostgreSQL/PostGIS and GeoServer for GIS validation
- Keeps the existing upload, extraction, conflict detection, report, chat, and auth flows intact

## Judge-Friendly Demo Story

GeoMind AI helps a user upload a land document and ask one simple question: has this property behaved like previous high-risk cases?

Demo flow:

1. The user uploads a land document.
2. GeoMind extracts owner, khasra, village, district, area, and cited evidence.
3. GeoMind matches the document to a PostGIS parcel.
4. GeoMind detects ownership, overlap, boundary, and area conflicts.
5. GeoMind stores the document metadata, extracted entities, risk report, and agent summary in MongoDB MCP memory.
6. The user clicks `Compare with Previous High-Risk Records`.
7. GeoMind fetches similar high-risk cases from MongoDB MCP.
8. Gemini compares the current property against those precedent cases and explains the matching reasons, risk posture, and recommendation.

## Architecture

### Google Cloud Agent Builder orchestration

The backend is structured so FastAPI exposes tool-like actions that Google Cloud Agent Builder can orchestrate:

- `extract_document_entities`
- `match_gis_parcel`
- `detect_conflicts`
- `fetch_mongodb_context`
- `generate_risk_report`
- `generate_pdf_report`

These tool wrappers live in [backend/app/services/agent_builder_tools.py](/c:/docker-workspace/geomaind/backend/app/services/agent_builder_tools.py).

### Core pipeline

1. `Planner Agent` defines the workflow.
2. `Document Agent` extracts structured land entities from the uploaded file.
3. `GIS Agent` validates the document against `land_parcels` in PostGIS.
4. `Conflict Agent` detects duplicate khasra, ownership mismatch, overlap, missing parcel, and area anomalies.
5. `Risk Agent` computes baseline risk signals.
6. `Report Agent` uses Gemini to generate a risk report and PDF.
7. `MongoDB MCP` stores prior cases and returns precedent context for comparison.

### Stack

- Frontend: React, Tailwind, Leaflet, Axios
- Backend: FastAPI, SQLAlchemy, ReportLab
- AI: Gemini / Vertex AI via `google-genai`
- GIS: PostgreSQL, PostGIS, GeoServer WMS/WFS helpers
- Agent memory and partner integration: MongoDB MCP
- Retrieval: pgvector document chunks

## New Hackathon Feature

### Compare With Previous High-Risk Records

Visible in the property detail page.

What it shows:

- Similar high-risk records from MongoDB MCP
- Matching reasons such as village, district, owner, or khasra overlap
- Gemini risk explanation
- Final recommendation

Backend endpoints:

- `POST /mcp/sync-document/{document_id}`
- `GET /mcp/high-risk-records`
- `POST /mcp/compare-property/{property_id}`

If MongoDB MCP is not configured, GeoMind falls back safely and the rest of the platform still works.

## Existing Product Capabilities

- Document upload
- AI extraction pipeline
- GIS parcel matching
- Conflict detection
- Risk scoring
- PDF report generation
- AI chat
- Agent logs
- pgvector document chunks
- PostGIS `land_parcels`
- GeoServer WMS/WFS helpers

## Key Files

- [backend/app/services/agent_builder_tools.py](/c:/docker-workspace/geomaind/backend/app/services/agent_builder_tools.py)
- [backend/app/services/mongodb_mcp.py](/c:/docker-workspace/geomaind/backend/app/services/mongodb_mcp.py)
- [backend/app/services/orchestration.py](/c:/docker-workspace/geomaind/backend/app/services/orchestration.py)
- [backend/app/services/ai_service.py](/c:/docker-workspace/geomaind/backend/app/services/ai_service.py)
- [backend/app/api/routes/mcp.py](/c:/docker-workspace/geomaind/backend/app/api/routes/mcp.py)
- [frontend/src/pages/PropertyDetailPage.jsx](/c:/docker-workspace/geomaind/frontend/src/pages/PropertyDetailPage.jsx)

## API Summary

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Documents and analysis:

- `POST /documents/upload`
- `POST /documents/upload-batch`
- `GET /documents`
- `POST /ai/analyze-document/{document_id}`
- `POST /ai/analyze-batch`
- `POST /ai/generate-report/{property_id}`

GIS and reports:

- `GET /gis/parcels`
- `POST /gis/match-property?property_id=`
- `GET /gis/conflicts/{property_id}`
- `GET /reports`
- `GET /reports/{report_id}/download`

MongoDB MCP:

- `POST /mcp/sync-document/{document_id}`
- `GET /mcp/high-risk-records`
- `POST /mcp/compare-property/{property_id}`

## Environment Variables

Important variables for the hackathon build:

- `MONGODB_URI`
- `MONGODB_DATABASE`
- `MONGODB_MCP_ENABLED=true`
- `GOOGLE_GENAI_USE_VERTEXAI=true`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`
- `GEMINI_API_KEY`

See [.env.example](/c:/docker-workspace/geomaind/.env.example) for the full list.

## Local Run

1. Configure `.env` values.
2. Start the stack:

```bash
docker compose up --build
```

3. Open:

- Frontend: `http://localhost:5173`
- Backend docs: `http://localhost:8000/docs`
- pgAdmin: `http://localhost:5050`
- GeoServer: `http://localhost:8084`

## Demo Credentials

- Admin: `admin@geomind.ai` / `admin123`
- Analyst: `analyst@geomind.ai` / `analyst123`
- User: `user@geomind.ai` / `user123`

## Demo Script

1. Sign in as admin.
2. Upload [demo/sample-land-record.txt](/c:/docker-workspace/geomaind/demo/sample-land-record.txt).
3. Run document analysis.
4. Open the property detail page.
5. Click `Compare with Previous High-Risk Records`.
6. Show the matched MongoDB MCP cases, Gemini explanation, and recommendation.
7. Download the PDF report to close the story.

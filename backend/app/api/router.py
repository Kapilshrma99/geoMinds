from fastapi import APIRouter

from app.api.routes import admin, ai, auth, dashboard, documents, gis, mcp, reports

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(gis.router, prefix="/gis", tags=["gis"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(mcp.router, prefix="/mcp", tags=["mcp"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

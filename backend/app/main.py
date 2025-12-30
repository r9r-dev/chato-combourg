import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import analyze, calculator, players, games, users, captures
from app.services.card_database import card_database
from app.services.yolo_detector import yolo_detector
from app.database import init_db

# Paths
BASE_DIR = Path(__file__).parent.parent
CARDS_DIR = BASE_DIR / "cards"
# Frontend dist can be at sibling level (dev) or inside BASE_DIR (Docker)
FRONTEND_DIR = BASE_DIR / "frontend" / "dist"
if not FRONTEND_DIR.exists():
    FRONTEND_DIR = BASE_DIR.parent / "frontend" / "dist"

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def check_required_files():
    """Check that all required files are present at startup."""
    issues = []

    # Check YOLO model
    models_dir = BASE_DIR / "models"
    yolo_model = models_dir / "card_detector" / "weights" / "best.pt"
    if not yolo_model.exists():
        issues.append(f"YOLO model not found: {yolo_model}")
        issues.append("  -> Mount ./backend/models:/app/models in docker-compose.yaml")

    # Check cards directory
    if not CARDS_DIR.exists():
        issues.append(f"Cards directory not found: {CARDS_DIR}")
    else:
        card_count = len(list(CARDS_DIR.glob("*.png")))
        if card_count == 0:
            issues.append(f"No card images found in {CARDS_DIR}")
        else:
            logger.info(f"Found {card_count} card images")

    # Check card attributes JSON
    card_attrs = CARDS_DIR / "card_attributes.json"
    if not card_attrs.exists():
        issues.append(f"Card attributes not found: {card_attrs}")

    return issues


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    # Startup
    logger.info("=" * 50)
    logger.info(f"  Chato Combourg v{settings.app_version}")
    logger.info("=" * 50)
    logger.info(f"Base directory: {BASE_DIR}")

    # Initialize database
    logger.info("Initializing database...")
    init_db()
    logger.info("Database ready")

    # Check required files
    logger.info("Checking required files...")
    issues = check_required_files()
    if issues:
        logger.error("=" * 60)
        logger.error("STARTUP CHECK FAILED - Missing required files:")
        for issue in issues:
            logger.error(f"  {issue}")
        logger.error("=" * 60)
        # Continue anyway to allow health checks, but log clearly
    else:
        logger.info("All required files present")

    # Load card database
    logger.info("Loading card database...")
    card_database.load()
    logger.info(f"Loaded {len(card_database)} cards")

    # Initialize YOLO detector
    logger.info("Initializing YOLO11 detector...")
    yolo_detector.initialize()
    logger.info("YOLO11 detector ready")

    yield

    # Shutdown
    logger.info("Shutting down...")


app = FastAPI(
    title="Chato Combourg API",
    description="API for identifying cards from photos of 3x3 grids",
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analyze.router)
app.include_router(calculator.router)
app.include_router(players.router)
app.include_router(games.router)
app.include_router(users.router)
app.include_router(captures.router)

# Mount static files for card images
app.mount("/cards", StaticFiles(directory=str(CARDS_DIR)), name="cards")

# Mount frontend static files if the build exists
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")


@app.get("/api")
async def api_info():
    """API info endpoint."""
    return {
        "name": "Chato Combourg API",
        "version": settings.app_version,
        "endpoints": {
            "analyze": "/api/analyze",
            "calculate": "/api/calculate",
            "health": "/api/health",
            "cards": "/api/cards",
        },
    }


@app.get("/{full_path:path}")
async def serve_spa(request: Request, full_path: str):
    """Serve the SPA for all non-API routes."""
    # Skip API routes
    if full_path.startswith("api/") or full_path.startswith("cards/"):
        return {"detail": "Not found"}

    # Serve index.html for SPA routing
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))

    # Fallback to API info if frontend not built
    return {
        "name": "Chato Combourg API",
        "version": settings.app_version,
        "message": "Frontend not built. Run 'npm run build' in frontend directory.",
        "endpoints": {
            "analyze": "/api/analyze",
            "calculate": "/api/calculate",
            "health": "/api/health",
            "cards": "/api/cards",
        },
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )

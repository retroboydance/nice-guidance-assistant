from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.auth import router as auth_router
from app.api.admin_users import router as admin_users_router
from app.models.database import engine, SessionLocal
from app.models.schema import Base
from app.services.seed_manager import SeedManager

# Create all tables in the SQLite database automatically
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-seed guidance library and initial users if empty
    db = SessionLocal()
    try:
        SeedManager.auto_seed_users_if_empty(db)
        SeedManager.auto_seed_if_empty(db)
    except Exception as e:
        print(f"Warning: Auto-seeding encountered an issue: {e}")
    finally:
        db.close()
    yield

app = FastAPI(
    title="NICE Guidance Assistant API",
    description="Backend API for the multi-tenant NICE baseline assessment tool.",
    version="1.0.0",
    lifespan=lifespan,
)

# Set up CORS so the React frontend can talk to the FastAPI backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Default Vite port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hook up our API endpoints
app.include_router(auth_router, prefix="/api")
app.include_router(admin_users_router, prefix="/api")
app.include_router(router, prefix="/api")

@app.get("/health")
def health_check():
    """Basic health check endpoint."""
    return {"status": "healthy", "service": "NICE Guidance BAT API"}

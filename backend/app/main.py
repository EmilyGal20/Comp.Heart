from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.db.session import SessionLocal, initialize_database
from app.routers import admin, ai, auth, automation, dashboard, knowledge, notifications, organizations, tasks, users
from app.seed.data import seed_database
from app.services.automation_service import run_sla_scan


settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0")
uploads_path = Path(settings.uploads_dir)
uploads_path.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.allowed_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    initialize_database()
    db = SessionLocal()
    try:
        seed_database(db)
        run_sla_scan(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"name": settings.app_name, "status": "healthy"}


app.mount("/uploads", StaticFiles(directory=uploads_path), name="uploads")
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(organizations.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)
app.include_router(users.router, prefix=settings.api_prefix)
app.include_router(knowledge.router, prefix=settings.api_prefix)
app.include_router(tasks.router, prefix=settings.api_prefix)
app.include_router(automation.router, prefix=settings.api_prefix)
app.include_router(notifications.router, prefix=settings.api_prefix)
app.include_router(ai.router, prefix=settings.api_prefix)
app.include_router(dashboard.router, prefix=settings.api_prefix)

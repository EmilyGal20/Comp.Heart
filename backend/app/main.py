import asyncio
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.realtime import realtime_manager
from app.db.session import SessionLocal, initialize_database
from app.models.user import User
from app.routers import admin, ai, auth, automation, dashboard, knowledge, notifications, organizations, tasks, users, work_management
from app.routers import analytics, chat, integrations, settings as settings_router
from app.seed.data import seed_database
from app.services.automation_service import run_sla_scan
from app.services.work_management_service import run_recurring_generation


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


async def recurring_scheduler():
    while True:
        await asyncio.sleep(settings.recurring_poll_seconds)
        db = SessionLocal()
        try:
            run_recurring_generation(db)
        finally:
            db.close()


@app.on_event("startup")
def on_startup():
    initialize_database()
    loop = asyncio.get_event_loop()
    realtime_manager.set_loop(loop)
    db = SessionLocal()
    try:
        seed_database(db)
        run_sla_scan(db)
        run_recurring_generation(db)
    finally:
        db.close()
    app.state.recurring_task = loop.create_task(recurring_scheduler())


@app.on_event("shutdown")
async def on_shutdown():
    scheduler = getattr(app.state, "recurring_task", None)
    if scheduler:
        scheduler.cancel()
        try:
            await scheduler
        except asyncio.CancelledError:
            pass


@app.get("/")
def root():
    return {"name": settings.app_name, "status": "healthy"}


@app.websocket("/ws/live")
async def live_updates(websocket: WebSocket):
    token = websocket.query_params.get("token")
    scope_org_id = websocket.query_params.get("scope_org_id")
    if not token:
        await websocket.close(code=4401)
        return
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        user_id = int(payload.get("user_id"))
    except (JWTError, TypeError, ValueError):
        await websocket.close(code=4401)
        return
    db = SessionLocal()
    connection_id = None
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            await websocket.close(code=4403)
            return
        connection_id = await realtime_manager.connect(
            websocket,
            user_id=user.id,
            organization_id=user.organization_id,
            role=user.role,
            scope_organization_id=int(scope_org_id) if scope_org_id else None,
        )
        await websocket.send_json({"event_type": "connection_ready", "organization_id": user.organization_id, "timestamp": asyncio.get_running_loop().time(), "data": {"message": "Realtime session connected", "role": user.role, "scope_organization_id": int(scope_org_id) if scope_org_id else None}})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if connection_id is not None:
            realtime_manager.disconnect(connection_id)
        db.close()


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
app.include_router(work_management.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(integrations.router, prefix=settings.api_prefix)
app.include_router(analytics.router, prefix=settings.api_prefix)
app.include_router(settings_router.router, prefix=settings.api_prefix)

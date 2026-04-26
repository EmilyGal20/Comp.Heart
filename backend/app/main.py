import asyncio
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.rate_limit import InMemoryRateLimiter
from app.core.realtime import realtime_manager
from app.db.session import SessionLocal, initialize_database
from app.models.user import User
from app.routers import admin, ai, auth, automation, dashboard, knowledge, notifications, organizations, tasks, users, work_management
from app.routers import analytics, chat, integrations, settings as settings_router
from app.routers import announcements, approvals, contacts, meetings, onboarding, search, self_notes
from app.seed.data import seed_database
from app.services.automation_service import run_sla_scan
from app.services.work_management_service import run_recurring_generation
# from fastapi.middleware.cors import CORSMiddleware

# origins = [
#     "http://localhost:8069",
#     "http://127.0.0.1:8069",
# ]


settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger("compheart.api")
app = FastAPI(title=settings.app_name, version="1.0.0")
uploads_path = Path(settings.uploads_dir)
uploads_path.mkdir(parents=True, exist_ok=True)
rate_limiter = InMemoryRateLimiter(settings.rate_limit_requests, settings.rate_limit_window_seconds)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[settings.allowed_origin, origins],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )
allowed_origins = [
    "http://localhost:8069",
    "http://127.0.0.1:8069",
]

if settings.allowed_origin and settings.allowed_origin not in allowed_origins:
    allowed_origins.append(settings.allowed_origin)

for extra in (part.strip() for part in (settings.cors_extra_origins or "").split(",") if part.strip()):
    if extra not in allowed_origins:
        allowed_origins.append(extra)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def basic_rate_limit(request: Request, call_next):
    if not settings.rate_limit_enabled or not request.url.path.startswith(settings.api_prefix):
        return await call_next(request)
    client_host = request.client.host if request.client else "unknown"
    bucket_key = f"{client_host}:{request.method}:{request.url.path}"
    if not rate_limiter.allow(bucket_key):
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Too many requests",
                "error": "Too many requests",
                "code": "RATE_LIMITED",
            },
        )
    return await call_next(request)


async def recurring_scheduler():
    while True:
        await asyncio.sleep(settings.recurring_poll_seconds)
        db = SessionLocal()
        try:
            run_recurring_generation(db)
        except Exception:
            logger.exception("Recurring scheduler run failed")
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
        logger.info("Application startup completed")
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


# @app.exception_handler(RequestValidationError)
# async def validation_exception_handler(request: Request, exc: RequestValidationError):
#     logger.warning("Validation error on %s %s", request.method, request.url.path)
#     return JSONResponse(status_code=422, content={"detail": "Validation error", "errors": exc.errors()})

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(
        "Validation error on %s %s: %s",
        request.method,
        request.url.path,
        exc.errors(),
    )
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation error",
            "error": "Validation error",
            "code": "VALIDATION_ERROR",
            "errors": exc.errors(),
        },
    )
    
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code >= 500:
        logger.error("HTTP exception on %s %s: %s", request.method, request.url.path, exc.detail)
    error_code = "HTTP_ERROR"
    if exc.status_code == 401:
        error_code = "UNAUTHORIZED"
    elif exc.status_code == 403:
        error_code = "FORBIDDEN"
    elif exc.status_code == 404:
        error_code = "NOT_FOUND"
    elif exc.status_code == 429:
        error_code = "RATE_LIMITED"
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error": exc.detail, "code": error_code},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": "Internal server error", "code": "INTERNAL_SERVER_ERROR"},
    )


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
    except Exception:
        logger.exception("Realtime websocket failed")
    finally:
        if connection_id is not None:
            realtime_manager.disconnect(connection_id)
        db.close()


app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(organizations.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)
app.include_router(users.router, prefix=settings.api_prefix)
app.include_router(knowledge.router, prefix=settings.api_prefix)
app.include_router(tasks.router, prefix=settings.api_prefix)
app.include_router(automation.router, prefix=settings.api_prefix)
app.include_router(approvals.router, prefix=settings.api_prefix)
app.include_router(notifications.router, prefix=settings.api_prefix)
app.include_router(ai.router, prefix=settings.api_prefix)
app.include_router(dashboard.router, prefix=settings.api_prefix)
app.include_router(work_management.router, prefix=settings.api_prefix)
app.include_router(chat.router, prefix=settings.api_prefix)
app.include_router(integrations.router, prefix=settings.api_prefix)
app.include_router(analytics.router, prefix=settings.api_prefix)
app.include_router(settings_router.router, prefix=settings.api_prefix)
app.include_router(announcements.router, prefix=settings.api_prefix)
app.include_router(meetings.router, prefix=settings.api_prefix)
app.include_router(self_notes.router, prefix=settings.api_prefix)
app.include_router(contacts.router, prefix=settings.api_prefix)
app.include_router(onboarding.router, prefix=settings.api_prefix)
app.include_router(search.router, prefix=settings.api_prefix)

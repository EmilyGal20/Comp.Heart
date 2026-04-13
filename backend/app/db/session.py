from sqlalchemy import inspect
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import get_settings


settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def initialize_database():
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    needs_reset = False
    if "users" in existing_tables and "organizations" not in existing_tables:
        needs_reset = True
    if "teams" in existing_tables:
        team_columns = {column["name"] for column in inspector.get_columns("teams")}
        if "organization_id" not in team_columns:
            needs_reset = True
    if "users" in existing_tables:
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "organization_id" not in user_columns:
            needs_reset = True
    if "tasks" in existing_tables:
        task_columns = {column["name"] for column in inspector.get_columns("tasks")}
        if "tags" not in task_columns or "related_knowledge_ids" not in task_columns or "parent_task_id" not in task_columns or "sprint_id" not in task_columns or "backlog_order" not in task_columns:
            needs_reset = True
    required_tables = {"task_activities", "task_attachments", "task_watchers", "sprints", "task_templates", "recurring_tasks", "task_approvals", "task_messages", "audit_logs"}
    if any(table not in existing_tables for table in required_tables):
        needs_reset = True
    if needs_reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

from sqlalchemy import create_engine
from sqlalchemy import inspect, text
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
        if "tags" not in task_columns or "related_knowledge_ids" not in task_columns or "parent_task_id" not in task_columns or "sprint_id" not in task_columns or "backlog_order" not in task_columns or "external_refs" not in task_columns:
            needs_reset = True
    if "automation_rules" in existing_tables:
        automation_columns = {column["name"] for column in inspector.get_columns("automation_rules")}
        if "scope_json" not in automation_columns or "last_triggered_at" not in automation_columns:
            needs_reset = True
    if "task_approvals" in existing_tables:
        approval_columns = {column["name"] for column in inspector.get_columns("task_approvals")}
        if "reason" not in approval_columns:
            needs_reset = True
    required_tables = {
        "task_activities",
        "task_attachments",
        "task_watchers",
        "sprints",
        "task_templates",
        "recurring_tasks",
        "task_approvals",
        "task_messages",
        "audit_logs",
        "chat_channels",
        "chat_memberships",
        "chat_messages",
        "organization_integrations",
        "sent_emails",
        "user_workspace_settings",
        "organization_settings",
        "knowledge_versions",
        "announcements",
        "announcement_reads",
        "meeting_summaries",
        "self_notes",
        "onboarding_steps",
        "user_onboarding_progress",
    }
    if any(table not in existing_tables for table in required_tables):
        needs_reset = True
    if not needs_reset and {"organizations", "chat_channels", "organization_integrations", "user_workspace_settings"}.issubset(existing_tables):
        with engine.connect() as connection:
            org_count = connection.execute(text("SELECT COUNT(*) FROM organizations")).scalar() or 0
            chat_count = connection.execute(text("SELECT COUNT(*) FROM chat_channels")).scalar() or 0
            integration_count = connection.execute(text("SELECT COUNT(*) FROM organization_integrations")).scalar() or 0
            workspace_count = connection.execute(text("SELECT COUNT(*) FROM user_workspace_settings")).scalar() or 0
        if org_count and (chat_count == 0 or integration_count == 0 or workspace_count == 0):
            needs_reset = True
    if needs_reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

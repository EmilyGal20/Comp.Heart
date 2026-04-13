from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(160), unique=True, nullable=False)
    slug = Column(String(120), unique=True, index=True, nullable=False)
    company_type = Column(String(100), nullable=False)
    industry = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    teams = relationship("Team", back_populates="organization")
    users = relationship("User", back_populates="organization")
    knowledge_items = relationship("KnowledgeItem", back_populates="organization")
    tasks = relationship("Task", back_populates="organization")
    sprints = relationship("Sprint", back_populates="organization")
    task_templates = relationship("TaskTemplate", back_populates="organization")
    recurring_tasks = relationship("RecurringTask", back_populates="organization")
    audit_logs = relationship("AuditLog", back_populates="organization")
    automation_rules = relationship("AutomationRule", back_populates="organization")
    notifications = relationship("Notification", back_populates="organization")
    conversations = relationship("AIConversation", back_populates="organization")
    chat_channels = relationship("ChatChannel", back_populates="organization")
    integrations = relationship("OrganizationIntegration", back_populates="organization", cascade="all, delete-orphan")
    sent_emails = relationship("SentEmail", back_populates="organization", cascade="all, delete-orphan")
    settings = relationship("OrganizationSetting", back_populates="organization", uselist=False, cascade="all, delete-orphan")
    announcements = relationship("Announcement", back_populates="organization", cascade="all, delete-orphan")
    meeting_summaries = relationship("MeetingSummary", back_populates="organization", cascade="all, delete-orphan")

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class Sprint(Base):
    __tablename__ = "sprints"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(180), nullable=False)
    goal = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String(40), default="PLANNED", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="sprints")
    tasks = relationship("Task", back_populates="sprint")


class TaskTemplate(Base):
    __tablename__ = "task_templates"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(180), nullable=False)
    title_template = Column(String(220), nullable=False)
    description_template = Column(Text, nullable=False)
    default_priority = Column(String(30), default="medium", nullable=False)
    default_tags = Column(Text, default="[]", nullable=False)
    default_sla = Column(Integer, default=24, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="task_templates")
    recurring_tasks = relationship("RecurringTask", back_populates="template")


class RecurringTask(Base):
    __tablename__ = "recurring_tasks"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("task_templates.id"), nullable=True)
    source_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    frequency = Column(String(20), nullable=False)
    next_run_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="recurring_tasks")
    template = relationship("TaskTemplate", back_populates="recurring_tasks")
    source_task = relationship("Task")


class TaskApproval(Base):
    __tablename__ = "task_approvals"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(30), default="PENDING", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task = relationship("Task", back_populates="approvals")
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])


class TaskMessage(Base):
    __tablename__ = "task_messages"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task = relationship("Task", back_populates="messages")
    user = relationship("User")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(120), nullable=False)
    entity_type = Column(String(80), nullable=False)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="audit_logs")
    user = relationship("User")

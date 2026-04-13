import json

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(180), nullable=False)
    description = Column(Text, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    status = Column(String(50), default="TODO", nullable=False)
    priority = Column(String(30), default="medium", nullable=False)
    tags_json = Column("tags", Text, default="[]", nullable=False)
    related_knowledge_ids_json = Column("related_knowledge_ids", Text, default="[]", nullable=False)
    parent_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id"), nullable=True)
    backlog_order = Column(Integer, default=0, nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    due_at = Column(DateTime(timezone=True), nullable=True)
    sla_hours = Column(Integer, default=24, nullable=False)
    sla_status = Column(String(40), default="on_track", nullable=False)
    related_knowledge_id = Column(Integer, ForeignKey("knowledge_items.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assignee_id], back_populates="assigned_tasks")
    creator = relationship("User", foreign_keys=[creator_id], back_populates="created_tasks")
    related_knowledge = relationship("KnowledgeItem", back_populates="tasks")
    sprint = relationship("Sprint", back_populates="tasks")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    activities = relationship("TaskActivity", back_populates="task", cascade="all, delete-orphan")
    attachments = relationship("TaskAttachment", back_populates="task", cascade="all, delete-orphan")
    watchers = relationship("TaskWatcher", back_populates="task", cascade="all, delete-orphan")
    approvals = relationship("TaskApproval", back_populates="task", cascade="all, delete-orphan")
    messages = relationship("TaskMessage", back_populates="task", cascade="all, delete-orphan")
    parent_task = relationship("Task", remote_side=[id], back_populates="subtasks")
    subtasks = relationship("Task", back_populates="parent_task", cascade="all, delete-orphan")

    @property
    def tags(self):
        try:
            return json.loads(self.tags_json or "[]")
        except json.JSONDecodeError:
            return []

    @tags.setter
    def tags(self, value):
        self.tags_json = json.dumps(value or [])

    @property
    def related_knowledge_ids(self):
        try:
            return json.loads(self.related_knowledge_ids_json or "[]")
        except json.JSONDecodeError:
            return []

    @related_knowledge_ids.setter
    def related_knowledge_ids(self, value):
        self.related_knowledge_ids_json = json.dumps(value or [])


class TaskComment(Base):
    __tablename__ = "task_comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task = relationship("Task", back_populates="comments")
    author = relationship("User")


class TaskActivity(Base):
    __tablename__ = "task_activities"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action_type = Column(String(80), nullable=False)
    field_changed = Column(String(80), nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task = relationship("Task", back_populates="activities")
    user = relationship("User")


class TaskAttachment(Base):
    __tablename__ = "task_attachments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task = relationship("Task", back_populates="attachments")
    uploader = relationship("User")


class TaskWatcher(Base):
    __tablename__ = "task_watchers"
    __table_args__ = (UniqueConstraint("task_id", "user_id", name="uq_task_watcher"),)

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task = relationship("Task", back_populates="watchers")
    user = relationship("User", back_populates="watched_tasks")

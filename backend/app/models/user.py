from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="teams")
    users = relationship("User", back_populates="team")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(160), unique=True, index=True, nullable=False)
    role = Column(String(80), nullable=False)
    title = Column(String(120), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    responsibilities = Column(Text, default="", nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    password = Column(String(255), default="compheart", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="users")
    team = relationship("Team", back_populates="users")
    knowledge_items = relationship("KnowledgeItem", back_populates="author")
    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assignee_id")
    created_tasks = relationship("Task", back_populates="creator", foreign_keys="Task.creator_id")
    notifications = relationship("Notification", back_populates="user")
    conversations = relationship("AIConversation", back_populates="user")

import json

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class ChatChannel(Base):
    __tablename__ = "chat_channels"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    name = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)
    channel_type = Column(String(40), default="ORG", nullable=False)
    is_private = Column(Boolean, default=False, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="chat_channels")
    team = relationship("Team", back_populates="chat_channels")
    creator = relationship("User", foreign_keys=[created_by])
    memberships = relationship("ChatMembership", back_populates="channel", cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="channel", cascade="all, delete-orphan")


class ChatMembership(Base):
    __tablename__ = "chat_memberships"
    __table_args__ = (UniqueConstraint("channel_id", "user_id", name="uq_chat_channel_user"),)

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("chat_channels.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    unread_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    channel = relationship("ChatChannel", back_populates="memberships")
    user = relationship("User", back_populates="chat_memberships")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("chat_channels.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    channel = relationship("ChatChannel", back_populates="messages")
    user = relationship("User", back_populates="chat_messages")


class OrganizationIntegration(Base):
    __tablename__ = "organization_integrations"
    __table_args__ = (UniqueConstraint("organization_id", "provider", name="uq_org_provider"),)

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    provider = Column(String(40), nullable=False)
    is_enabled = Column(Boolean, default=False, nullable=False)
    config_json = Column(Text, default="{}", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="integrations")

    @property
    def config(self):
        try:
            return json.loads(self.config_json or "{}")
        except json.JSONDecodeError:
            return {}

    @config.setter
    def config(self, value):
        self.config_json = json.dumps(value or {})


class SentEmail(Base):
    __tablename__ = "sent_emails"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    sender_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_ids_json = Column(Text, default="[]", nullable=False)
    subject = Column(String(220), nullable=False)
    body = Column(Text, nullable=False)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    status = Column(String(40), default="SENT", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="sent_emails")
    sender = relationship("User", back_populates="sent_emails")
    task = relationship("Task", back_populates="sent_emails")

    @property
    def recipient_ids(self):
        try:
            return json.loads(self.recipient_ids_json or "[]")
        except json.JSONDecodeError:
            return []

    @recipient_ids.setter
    def recipient_ids(self, value):
        self.recipient_ids_json = json.dumps(value or [])


class UserWorkspaceSetting(Base):
    __tablename__ = "user_workspace_settings"
    __table_args__ = (UniqueConstraint("user_id", name="uq_workspace_user"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    default_task_view = Column(String(30), default="list", nullable=False)
    density = Column(String(30), default="comfortable", nullable=False)
    notify_email = Column(Boolean, default=True, nullable=False)
    notify_desktop = Column(Boolean, default=True, nullable=False)
    theme_mode = Column(String(30), default="dark", nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="workspace_setting")


class OrganizationSetting(Base):
    __tablename__ = "organization_settings"
    __table_args__ = (UniqueConstraint("organization_id", name="uq_org_setting"),)

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    default_sla_hours = Column(Integer, default=24, nullable=False)
    require_approval_for_critical = Column(Boolean, default=True, nullable=False)
    recurring_auto_run = Column(Boolean, default=True, nullable=False)
    slack_notifications_enabled = Column(Boolean, default=False, nullable=False)
    email_notifications_enabled = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="settings")

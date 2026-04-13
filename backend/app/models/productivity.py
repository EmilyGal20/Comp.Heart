import json

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class KnowledgeVersion(Base):
    __tablename__ = "knowledge_versions"

    id = Column(Integer, primary_key=True, index=True)
    knowledge_item_id = Column(Integer, ForeignKey("knowledge_items.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    title_snapshot = Column(String(180), nullable=False)
    content_snapshot = Column(Text, nullable=False)
    summary_snapshot = Column(Text, nullable=False)
    edited_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    knowledge_item = relationship("KnowledgeItem", back_populates="versions")
    editor = relationship("User")


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    title = Column(String(220), nullable=False)
    content = Column(Text, nullable=False)
    severity = Column(String(40), default="medium", nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    target_role = Column(String(80), nullable=True)
    target_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="announcements")
    creator = relationship("User", foreign_keys=[created_by])
    target_team = relationship("Team", foreign_keys=[target_team_id])
    reads = relationship("AnnouncementRead", back_populates="announcement", cascade="all, delete-orphan")


class AnnouncementRead(Base):
    __tablename__ = "announcement_reads"
    __table_args__ = (UniqueConstraint("announcement_id", "user_id", name="uq_announcement_read_user"),)

    id = Column(Integer, primary_key=True, index=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    announcement = relationship("Announcement", back_populates="reads")
    user = relationship("User")


class MeetingSummary(Base):
    __tablename__ = "meeting_summaries"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    title = Column(String(220), nullable=False)
    raw_notes = Column(Text, nullable=False)
    summary = Column(Text, nullable=False)
    action_items_json = Column(Text, default="[]", nullable=False)
    decisions_json = Column(Text, default="[]", nullable=False)
    followups_json = Column(Text, default="[]", nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="meeting_summaries")
    team = relationship("Team")
    creator = relationship("User", foreign_keys=[created_by])

    @property
    def action_items(self):
        try:
            return json.loads(self.action_items_json or "[]")
        except json.JSONDecodeError:
            return []

    @action_items.setter
    def action_items(self, value):
        self.action_items_json = json.dumps(value or [])

    @property
    def decisions(self):
        try:
            return json.loads(self.decisions_json or "[]")
        except json.JSONDecodeError:
            return []

    @decisions.setter
    def decisions(self, value):
        self.decisions_json = json.dumps(value or [])

    @property
    def followups(self):
        try:
            return json.loads(self.followups_json or "[]")
        except json.JSONDecodeError:
            return []

    @followups.setter
    def followups(self, value):
        self.followups_json = json.dumps(value or [])


class SelfNote(Base):
    __tablename__ = "self_notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(180), nullable=False)
    content = Column(Text, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    color = Column(String(40), default="cyan", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="self_notes")


class OnboardingStep(Base):
    __tablename__ = "onboarding_steps"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    title = Column(String(180), nullable=False)
    description = Column(Text, nullable=False)
    role_target = Column(String(80), nullable=True)
    action_path = Column(String(220), nullable=True)
    action_label = Column(String(120), nullable=True)
    step_type = Column(String(80), default="general", nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization")
    progress = relationship("UserOnboardingProgress", back_populates="step", cascade="all, delete-orphan")


class UserOnboardingProgress(Base):
    __tablename__ = "user_onboarding_progress"
    __table_args__ = (UniqueConstraint("user_id", "step_id", name="uq_user_onboarding_progress"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    step_id = Column(Integer, ForeignKey("onboarding_steps.id"), nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="onboarding_progress")
    step = relationship("OnboardingStep", back_populates="progress")

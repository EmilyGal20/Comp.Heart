from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(180), nullable=False)
    message = Column(Text, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    type = Column(String(60), nullable=False)
    severity = Column(String(40), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    role_target = Column(String(80), nullable=True)
    is_org_wide = Column(Boolean, default=False, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="notifications")
    user = relationship("User", back_populates="notifications")

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text, func
from sqlalchemy.orm import relationship

from app.db.session import Base


knowledge_tags = Table(
    "knowledge_item_tags",
    Base.metadata,
    Column("knowledge_item_id", Integer, ForeignKey("knowledge_items.id"), primary_key=True),
    Column("knowledge_tag_id", Integer, ForeignKey("knowledge_tags.id"), primary_key=True),
)


class KnowledgeItem(Base):
    __tablename__ = "knowledge_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(180), nullable=False)
    slug = Column(String(180), unique=True, index=True, nullable=False)
    category = Column(String(80), nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    content = Column(Text, nullable=False)
    summary = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_published = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="knowledge_items")
    author = relationship("User", back_populates="knowledge_items")
    tags = relationship("KnowledgeTag", secondary=knowledge_tags, back_populates="items")
    tasks = relationship("Task", back_populates="related_knowledge")


class KnowledgeTag(Base):
    __tablename__ = "knowledge_tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(80), unique=True, nullable=False)

    items = relationship("KnowledgeItem", secondary=knowledge_tags, back_populates="tags")

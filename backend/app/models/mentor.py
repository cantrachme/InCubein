from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, String, Text, UniqueConstraint, true
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.ai_enrichment import AIEnrichment
    from app.models.incubator import Incubator
    from app.models.source_record import SourceRecord


class Mentor(TimestampMixin, Base):
    __tablename__ = "mentors"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_mentors_slug"),
        Index("ix_mentors_full_name", "full_name"),
        Index("ix_mentors_incubator_id", "incubator_id"),
        Index("ix_mentors_is_active", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid7,
    )
    incubator_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("incubators.id"),
        nullable=True,
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    headline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    website: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
    )

    incubator: Mapped[Incubator | None] = relationship(
        "Incubator",
        back_populates="mentors",
    )
    source_records: Mapped[list[SourceRecord]] = relationship(
        "SourceRecord",
        back_populates="mentor",
    )
    ai_enrichments: Mapped[list[AIEnrichment]] = relationship(
        "AIEnrichment",
        back_populates="mentor",
    )

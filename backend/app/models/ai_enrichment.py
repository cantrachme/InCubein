from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Index,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums.ai_enrichment_status import AIEnrichmentStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.incubator import Incubator
    from app.models.investor import Investor
    from app.models.mentor import Mentor
    from app.models.startup import Startup


class AIEnrichment(TimestampMixin, Base):
    __tablename__ = "ai_enrichments"
    __table_args__ = (
        CheckConstraint(
            "num_nonnulls(incubator_id, startup_id, mentor_id, investor_id) = 1",
            name="ck_ai_enrichments_exactly_one_canonical_entity",
        ),
        Index("ix_ai_enrichments_provider", "provider"),
        Index("ix_ai_enrichments_model_name", "model_name"),
        Index("ix_ai_enrichments_status", "status"),
        Index("ix_ai_enrichments_input_hash", "input_hash"),
        Index("ix_ai_enrichments_incubator_id", "incubator_id"),
        Index("ix_ai_enrichments_startup_id", "startup_id"),
        Index("ix_ai_enrichments_mentor_id", "mentor_id"),
        Index("ix_ai_enrichments_investor_id", "investor_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid7,
    )
    provider: Mapped[str] = mapped_column(String(255), nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    enrichment_type: Mapped[str] = mapped_column(String(255), nullable=False)
    prompt_version: Mapped[str | None] = mapped_column(String(255), nullable=True)
    input_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_response: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    parsed_output: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[AIEnrichmentStatus] = mapped_column(
        SAEnum(
            AIEnrichmentStatus,
            name="ai_enrichment_status_enum",
            native_enum=True,
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=False,
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    incubator_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("incubators.id"),
        nullable=True,
    )
    startup_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("startups.id"),
        nullable=True,
    )
    mentor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("mentors.id"),
        nullable=True,
    )
    investor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("investors.id"),
        nullable=True,
    )

    incubator: Mapped[Incubator | None] = relationship(
        "Incubator",
        back_populates="ai_enrichments",
    )
    startup: Mapped[Startup | None] = relationship(
        "Startup",
        back_populates="ai_enrichments",
    )
    mentor: Mapped[Mentor | None] = relationship(
        "Mentor",
        back_populates="ai_enrichments",
    )
    investor: Mapped[Investor | None] = relationship(
        "Investor",
        back_populates="ai_enrichments",
    )

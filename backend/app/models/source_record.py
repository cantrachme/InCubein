from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums.entity_type import EntityType
from app.enums.source_status import SourceStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.incubator import Incubator
    from app.models.investor import Investor
    from app.models.mentor import Mentor
    from app.models.pipeline_log import PipelineLog
    from app.models.startup import Startup


class SourceRecord(TimestampMixin, Base):
    __tablename__ = "source_records"
    __table_args__ = (
        CheckConstraint(
            "num_nonnulls(incubator_id, startup_id, mentor_id, investor_id) = 1",
            name="ck_source_records_exactly_one_canonical_entity",
        ),
        Index("ix_source_records_status", "status"),
        Index("ix_source_records_source_name", "source_name"),
        Index("ix_source_records_content_hash", "content_hash"),
        Index("ix_source_records_incubator_id", "incubator_id"),
        Index("ix_source_records_startup_id", "startup_id"),
        Index("ix_source_records_mentor_id", "mentor_id"),
        Index("ix_source_records_investor_id", "investor_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid7,
    )
    entity_type: Mapped[EntityType] = mapped_column(
        SAEnum(
            EntityType,
            name="entity_type_enum",
            native_enum=True,
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=False,
    )
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    status: Mapped[SourceStatus] = mapped_column(
        SAEnum(
            SourceStatus,
            name="source_status_enum",
            native_enum=True,
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=False,
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
        back_populates="source_records",
    )
    startup: Mapped[Startup | None] = relationship(
        "Startup",
        back_populates="source_records",
    )
    mentor: Mapped[Mentor | None] = relationship(
        "Mentor",
        back_populates="source_records",
    )
    investor: Mapped[Investor | None] = relationship(
        "Investor",
        back_populates="source_records",
    )
    logs: Mapped[list[PipelineLog]] = relationship(
        "PipelineLog",
        back_populates="source_record",
    )

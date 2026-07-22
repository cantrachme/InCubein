from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums.pipeline_status import PipelineStatus
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.source_record import SourceRecord


class PipelineLog(TimestampMixin, Base):
    __tablename__ = "pipeline_logs"
    __table_args__ = (
        Index("ix_pipeline_logs_source_record_id", "source_record_id"),
        Index("ix_pipeline_logs_stage", "stage"),
        Index("ix_pipeline_logs_status", "status"),
        Index("ix_pipeline_logs_started_at", "started_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid7,
    )
    source_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("source_records.id"),
        nullable=False,
    )
    stage: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[PipelineStatus] = mapped_column(
        SAEnum(
            PipelineStatus,
            name="pipeline_status_enum",
            native_enum=True,
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
    )

    source_record: Mapped[SourceRecord] = relationship(
        "SourceRecord",
        back_populates="logs",
    )

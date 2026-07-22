from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    true,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums.funding_stage import FundingStage

if TYPE_CHECKING:
    from app.models.ai_enrichment import AIEnrichment
    from app.models.incubator import Incubator
    from app.models.relationship import Relationship
    from app.models.source_record import SourceRecord


class Startup(Base):
    __tablename__ = "startups"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_startups_slug"),
        CheckConstraint(
            f"founded_year BETWEEN 1800 AND {datetime.now().year}",
            name="ck_startups_founded_year",
        ),
        Index("ix_startups_name", "name"),
        Index("ix_startups_slug", "slug"),
        Index("ix_startups_incubator_id", "incubator_id"),
        Index("ix_startups_funding_stage", "funding_stage"),
        Index("ix_startups_is_active", "is_active"),
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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    founded_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    funding_stage: Mapped[FundingStage] = mapped_column(
        SAEnum(
            FundingStage,
            name="funding_stage_enum",
            native_enum=True,
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=False,
        default=FundingStage.UNKNOWN,
        server_default=FundingStage.UNKNOWN.value,
    )
    website: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    incubator: Mapped[Incubator | None] = relationship(
        "Incubator",
        back_populates="startups",
    )
    source_records: Mapped[list[SourceRecord]] = relationship(
        "SourceRecord",
        back_populates="startup",
    )
    ai_enrichments: Mapped[list[AIEnrichment]] = relationship(
        "AIEnrichment",
        back_populates="startup",
    )
    relationships: Mapped[list[Relationship]] = relationship(
        "Relationship",
        back_populates="startup",
    )

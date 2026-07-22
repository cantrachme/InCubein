from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Index, String, Text, UniqueConstraint, true
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.ai_enrichment import AIEnrichment
    from app.models.source_record import SourceRecord


class Investor(TimestampMixin, Base):
    __tablename__ = "investors"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_investors_slug"),
        Index("ix_investors_name", "name"),
        Index("ix_investors_organization", "organization"),
        Index("ix_investors_is_active", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid7,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    organization: Mapped[str | None] = mapped_column(String(255), nullable=True)
    designation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    website: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    investment_stage: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    investment_focus: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=true(),
    )

    source_records: Mapped[list[SourceRecord]] = relationship(
        "SourceRecord",
        back_populates="investor",
    )
    ai_enrichments: Mapped[list[AIEnrichment]] = relationship(
        "AIEnrichment",
        back_populates="investor",
    )

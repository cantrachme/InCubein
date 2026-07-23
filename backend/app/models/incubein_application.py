from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Boolean, Float, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class IncubeinApplication(TimestampMixin, Base):
    __tablename__ = "incubein_applications"
    __table_args__ = (
        Index("ix_incubein_applications_rank", "rank"),
        Index("ix_incubein_applications_startup_name", "startup_name"),
        Index("ix_incubein_applications_final_score", "final_score"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid7,
    )
    startup_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sector: Mapped[str] = mapped_column(String(255), nullable=False)
    stage: Mapped[str] = mapped_column(String(255), nullable=False)
    revenue: Mapped[float] = mapped_column(Float, nullable=False)
    team_size: Mapped[int] = mapped_column(Integer, nullable=False)
    dpiit: Mapped[bool] = mapped_column(Boolean, nullable=False)
    dpiit_number: Mapped[str] = mapped_column(String(255), nullable=False)
    website: Mapped[str] = mapped_column(String(2048), nullable=False)
    pitch_deck_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    business_summary: Mapped[str] = mapped_column(Text, nullable=False)
    competitors: Mapped[str] = mapped_column(Text, nullable=False)
    applied_other: Mapped[str] = mapped_column(Text, nullable=False)
    litigation: Mapped[str] = mapped_column(Text, nullable=False)
    highest_qualification: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    school_university: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    gender: Mapped[str] = mapped_column(String(100), nullable=False)
    city_state: Mapped[str] = mapped_column(String(255), nullable=False)
    comments: Mapped[str] = mapped_column(Text, nullable=False)
    legal_entity: Mapped[str] = mapped_column(String(255), nullable=False)
    applying_for: Mapped[str] = mapped_column(String(255), nullable=False)
    timestamp: Mapped[str] = mapped_column(String(255), nullable=False)
    rule_score: Mapped[float] = mapped_column(Float, nullable=False)
    llm_score: Mapped[float] = mapped_column(Float, nullable=False)
    final_score: Mapped[float] = mapped_column(Float, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    encrypted_fields: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
    )
    rule_breakdown: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
    )
    evaluation: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
    )
    similarity_matches: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=False,
    )

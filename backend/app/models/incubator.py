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
from app.enums.organization_type import OrganizationType

if TYPE_CHECKING:
    from app.models.ai_enrichment import AIEnrichment
    from app.models.city import City
    from app.models.contact import Contact
    from app.models.mentor import Mentor
    from app.models.relationship import Relationship
    from app.models.source_record import SourceRecord
    from app.models.startup import Startup
    from app.models.website import Website


class Incubator(Base):
    __tablename__ = "incubators"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_incubators_slug"),
        CheckConstraint(
            f"founded_year BETWEEN 1800 AND {datetime.now().year}",
            name="ck_incubators_founded_year",
        ),
        Index("ix_incubators_name", "name"),
        Index("ix_incubators_slug", "slug"),
        Index("ix_incubators_city_id", "city_id"),
        Index("ix_incubators_is_active", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid7,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    city_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cities.id"),
        nullable=False,
    )
    organization_type: Mapped[OrganizationType] = mapped_column(
        SAEnum(
            OrganizationType,
            name="organization_type_enum",
            native_enum=True,
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=False,
    )
    founded_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
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

    city: Mapped[City] = relationship(
        "City",
        back_populates="incubators",
    )
    startups: Mapped[list[Startup]] = relationship(
        "Startup",
        back_populates="incubator",
    )
    mentors: Mapped[list[Mentor]] = relationship(
        "Mentor",
        back_populates="incubator",
    )
    contacts: Mapped[list[Contact]] = relationship(
        "Contact",
        back_populates="incubator",
    )
    websites: Mapped[list[Website]] = relationship(
        "Website",
        back_populates="incubator",
    )
    source_records: Mapped[list[SourceRecord]] = relationship(
        "SourceRecord",
        back_populates="incubator",
    )
    ai_enrichments: Mapped[list[AIEnrichment]] = relationship(
        "AIEnrichment",
        back_populates="incubator",
    )
    relationships: Mapped[list[Relationship]] = relationship(
        "Relationship",
        back_populates="incubator",
    )

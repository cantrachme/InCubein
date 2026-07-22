import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, Enum as SAEnum, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.enums.relationship import RelationshipEntityType, RelationshipType
from app.models.mixins import TimestampMixin


class Relationship(TimestampMixin, Base):
    __tablename__ = "relationships"
    __table_args__ = (
        CheckConstraint(
            "(target_id IS NOT NULL AND target_value IS NULL) OR "
            "(target_id IS NULL AND target_value IS NOT NULL)",
            name="ck_relationships_exactly_one_target",
        ),
        Index(
            "ix_relationships_source_type_source_id",
            "source_type",
            "source_id",
        ),
        Index(
            "ix_relationships_target_type_target_id",
            "target_type",
            "target_id",
        ),
        Index("ix_relationships_relationship_type", "relationship_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid7,
    )
    source_type: Mapped[RelationshipEntityType] = mapped_column(
        SAEnum(
            RelationshipEntityType,
            name="relationship_source_type_enum",
            native_enum=True,
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=False,
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
    )
    relationship_type: Mapped[RelationshipType] = mapped_column(
        SAEnum(
            RelationshipType,
            name="relationship_type_enum",
            native_enum=True,
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=False,
    )
    target_type: Mapped[RelationshipEntityType] = mapped_column(
        SAEnum(
            RelationshipEntityType,
            name="relationship_target_type_enum",
            native_enum=True,
            values_callable=lambda enum_type: [member.value for member in enum_type],
        ),
        nullable=False,
    )
    target_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )
    target_value: Mapped[str | None] = mapped_column(String(255), nullable=True)
    confidence: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

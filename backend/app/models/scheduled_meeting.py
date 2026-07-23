from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.outreach_lead import OutreachLead


class ScheduledMeeting(TimestampMixin, Base):
    __tablename__ = "scheduled_meetings"
    __table_args__ = (
        UniqueConstraint(
            "lead_id",
            name="uq_scheduled_meetings_lead_id",
        ),
        Index("ix_scheduled_meetings_status", "status"),
        Index("ix_scheduled_meetings_date", "date"),
        Index(
            "ix_scheduled_meetings_calendar_event_id",
            "calendar_event_id",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    lead_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("outreach_leads.id", ondelete="CASCADE"),
        nullable=False,
    )
    incubator_name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[str] = mapped_column(String(50), nullable=False)
    time: Mapped[str] = mapped_column(String(50), nullable=False)
    calendar_event_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="Scheduled",
        server_default=text("'Scheduled'"),
    )

    lead: Mapped[OutreachLead] = relationship(
        "OutreachLead",
        back_populates="meetings",
    )

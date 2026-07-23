from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.scheduled_meeting import ScheduledMeeting


class OutreachLead(TimestampMixin, Base):
    __tablename__ = "outreach_leads"
    __table_args__ = (
        Index("ix_outreach_leads_email", "email"),
        Index("ix_outreach_leads_incubator_id", "incubator_id"),
        Index("ix_outreach_leads_status", "status"),
        Index("ix_outreach_leads_sent_at", "sent_at"),
        Index("ix_outreach_leads_last_followup_at", "last_followup_at"),
        Index(
            "ix_outreach_leads_email_incubator_name",
            "email",
            "incubator_name",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    incubator_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    incubator_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="Draft",
        server_default=text("'Draft'"),
    )
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    reply_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    reply_detected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    intent_classification: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    lead_score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    meeting_link: Mapped[str | None] = mapped_column(
        String(2048),
        nullable=True,
    )
    meeting_scheduled_at: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_action_date: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="",
        server_default=text("''"),
    )
    contact_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    last_contact_reason: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="None",
        server_default=text("'None'"),
    )
    followup_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    last_followup_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    reply_sentiment: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    reply_urgency: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    reply_reason: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    meetings: Mapped[list[ScheduledMeeting]] = relationship(
        "ScheduledMeeting",
        back_populates="lead",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

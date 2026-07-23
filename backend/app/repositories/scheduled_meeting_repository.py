from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session, joinedload

from app.models.scheduled_meeting import ScheduledMeeting


class ScheduledMeetingRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: str) -> ScheduledMeeting | None:
        return self.db.get(ScheduledMeeting, id)

    def get_by_lead_id(self, lead_id: str) -> ScheduledMeeting | None:
        statement = select(ScheduledMeeting).where(
            ScheduledMeeting.lead_id == lead_id
        )
        return self.db.execute(statement).scalar_one_or_none()

    def exists_by_lead_id(self, lead_id: str) -> bool:
        statement = select(
            exists().where(ScheduledMeeting.lead_id == lead_id)
        )
        return bool(self.db.scalar(statement))

    def list(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ScheduledMeeting]:
        statement = (
            select(ScheduledMeeting)
            .options(joinedload(ScheduledMeeting.lead))
            .offset(skip)
            .limit(limit)
        )
        return list(self.db.execute(statement).scalars().all())

    def list_all(self) -> list[ScheduledMeeting]:
        statement = select(ScheduledMeeting).options(
            joinedload(ScheduledMeeting.lead)
        )
        return list(self.db.execute(statement).scalars().all())

    def create(
        self,
        scheduled_meeting: ScheduledMeeting,
    ) -> ScheduledMeeting:
        self.db.add(scheduled_meeting)
        self.db.flush()
        self.db.refresh(scheduled_meeting)
        return scheduled_meeting

    def update(
        self,
        scheduled_meeting: ScheduledMeeting,
    ) -> ScheduledMeeting:
        self.db.add(scheduled_meeting)
        self.db.flush()
        return scheduled_meeting

    def delete(self, scheduled_meeting: ScheduledMeeting) -> None:
        self.db.delete(scheduled_meeting)
        self.db.flush()

    def delete_by_lead_id(self, lead_id: str) -> int:
        statement = delete(ScheduledMeeting).where(
            ScheduledMeeting.lead_id == lead_id
        )
        result = self.db.execute(statement)
        self.db.flush()
        return result.rowcount or 0

    def delete_all(self) -> int:
        result = self.db.execute(delete(ScheduledMeeting))
        self.db.flush()
        return result.rowcount or 0

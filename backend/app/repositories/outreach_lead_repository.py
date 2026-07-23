from sqlalchemy import delete, exists, func, or_, select
from sqlalchemy.orm import Session

from app.models.outreach_lead import OutreachLead


class OutreachLeadRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: str) -> OutreachLead | None:
        return self.db.get(OutreachLead, id)

    def get_by_email(self, email: str) -> OutreachLead | None:
        statement = select(OutreachLead).where(OutreachLead.email == email)
        return self.db.execute(statement).scalars().first()

    def get_by_email_and_name(
        self,
        email: str,
        incubator_name: str,
    ) -> OutreachLead | None:
        statement = select(OutreachLead).where(
            OutreachLead.email == email,
            OutreachLead.incubator_name == incubator_name,
        )
        return self.db.execute(statement).scalars().first()

    def list(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> list[OutreachLead]:
        statement = select(OutreachLead).offset(skip).limit(limit)
        return list(self.db.execute(statement).scalars().all())

    def list_all(self) -> list[OutreachLead]:
        statement = select(OutreachLead)
        return list(self.db.execute(statement).scalars().all())

    def list_by_statuses(self, statuses: list[str]) -> list[OutreachLead]:
        statement = select(OutreachLead).where(
            OutreachLead.status.in_(statuses)
        )
        return list(self.db.execute(statement).scalars().all())

    def count(self) -> int:
        statement = select(func.count()).select_from(OutreachLead)
        return int(self.db.scalar(statement) or 0)

    def exists_by_email(self, email: str) -> bool:
        statement = select(
            exists().where(OutreachLead.email == email)
        )
        return bool(self.db.scalar(statement))

    def exists_by_incubator_id(self, incubator_id: str) -> bool:
        statement = select(
            exists().where(OutreachLead.incubator_id == incubator_id)
        )
        return bool(self.db.scalar(statement))

    def exists_by_incubator_or_email(
        self,
        incubator_id: str,
        email: str,
    ) -> bool:
        statement = select(
            exists().where(
                or_(
                    OutreachLead.incubator_id == incubator_id,
                    OutreachLead.email == email,
                )
            )
        )
        return bool(self.db.scalar(statement))

    def create(self, outreach_lead: OutreachLead) -> OutreachLead:
        self.db.add(outreach_lead)
        self.db.flush()
        self.db.refresh(outreach_lead)
        return outreach_lead

    def update(self, outreach_lead: OutreachLead) -> OutreachLead:
        self.db.add(outreach_lead)
        self.db.flush()
        return outreach_lead

    def delete(self, outreach_lead: OutreachLead) -> None:
        self.db.delete(outreach_lead)
        self.db.flush()

    def delete_all(self) -> int:
        result = self.db.execute(delete(OutreachLead))
        self.db.flush()
        return result.rowcount or 0

    def delete_by_incubator_id(self, incubator_id: str) -> int:
        statement = delete(OutreachLead).where(
            OutreachLead.incubator_id == incubator_id
        )
        result = self.db.execute(statement)
        self.db.flush()
        return result.rowcount or 0

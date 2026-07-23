import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.incubein_application import IncubeinApplication


class IncubeinApplicationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(
        self,
        id: uuid.UUID,
    ) -> IncubeinApplication | None:
        return self.db.get(IncubeinApplication, id)

    def list_ordered_by_rank(self) -> list[IncubeinApplication]:
        statement = select(IncubeinApplication).order_by(
            IncubeinApplication.rank
        )
        return list(self.db.execute(statement).scalars().all())

    def list_by_ids(
        self,
        ids: list[uuid.UUID],
    ) -> list[IncubeinApplication]:
        if not ids:
            return []
        statement = select(IncubeinApplication).where(
            IncubeinApplication.id.in_(ids)
        )
        return list(self.db.execute(statement).scalars().all())

    def create(
        self,
        application: IncubeinApplication,
    ) -> IncubeinApplication:
        self.db.add(application)
        self.db.flush()
        self.db.refresh(application)
        return application

    def bulk_create(
        self,
        applications: list[IncubeinApplication],
    ) -> list[IncubeinApplication]:
        self.db.add_all(applications)
        self.db.flush()
        return applications

    def replace_all(
        self,
        applications: list[IncubeinApplication],
    ) -> list[IncubeinApplication]:
        self.delete_all()
        return self.bulk_create(applications)

    def delete(self, application: IncubeinApplication) -> None:
        self.db.delete(application)
        self.db.flush()

    def delete_all(self) -> int:
        result = self.db.execute(delete(IncubeinApplication))
        self.db.flush()
        return result.rowcount or 0

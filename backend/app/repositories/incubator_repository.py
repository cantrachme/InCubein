import uuid

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.incubator import Incubator


class IncubatorRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: uuid.UUID) -> Incubator | None:
        return self.db.get(Incubator, id)

    def get_by_slug(self, slug: str) -> Incubator | None:
        statement = select(Incubator).where(Incubator.slug == slug)
        return self.db.execute(statement).scalar_one_or_none()

    def list(self, skip: int = 0, limit: int = 100) -> list[Incubator]:
        statement = select(Incubator).offset(skip).limit(limit)
        return list(self.db.execute(statement).scalars().all())

    def create(self, incubator: Incubator) -> Incubator:
        self.db.add(incubator)
        self.db.flush()
        self.db.refresh(incubator)
        return incubator

    def update(self, incubator: Incubator) -> Incubator:
        self.db.add(incubator)
        self.db.flush()
        return incubator

    def delete(self, incubator: Incubator) -> None:
        self.db.delete(incubator)
        self.db.flush()

    def exists_by_slug(self, slug: str) -> bool:
        statement = select(exists().where(Incubator.slug == slug))
        return bool(self.db.scalar(statement))

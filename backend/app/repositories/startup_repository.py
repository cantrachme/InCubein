import uuid

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.startup import Startup


class StartupRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: uuid.UUID) -> Startup | None:
        return self.db.get(Startup, id)

    def get_by_slug(self, slug: str) -> Startup | None:
        statement = select(Startup).where(Startup.slug == slug)
        return self.db.execute(statement).scalar_one_or_none()

    def list(self, skip: int = 0, limit: int = 100) -> list[Startup]:
        statement = select(Startup).offset(skip).limit(limit)
        return list(self.db.execute(statement).scalars().all())

    def create(self, startup: Startup) -> Startup:
        self.db.add(startup)
        self.db.flush()
        self.db.refresh(startup)
        return startup

    def update(self, startup: Startup) -> Startup:
        self.db.add(startup)
        self.db.flush()
        return startup

    def delete(self, startup: Startup) -> None:
        self.db.delete(startup)
        self.db.flush()

    def exists_by_slug(self, slug: str) -> bool:
        statement = select(exists().where(Startup.slug == slug))
        return bool(self.db.scalar(statement))

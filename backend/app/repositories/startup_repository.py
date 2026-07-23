import uuid

from sqlalchemy import exists, select, update
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

    def reassign_incubator(
        self,
        duplicate_id: uuid.UUID,
        canonical_id: uuid.UUID,
    ) -> int:
        if duplicate_id == canonical_id:
            return 0

        statement = (
            update(Startup)
            .where(Startup.incubator_id == duplicate_id)
            .values(incubator_id=canonical_id)
            .execution_options(synchronize_session="fetch")
        )
        result = self.db.execute(statement)
        return result.rowcount or 0

    def exists_by_slug(self, slug: str) -> bool:
        statement = select(exists().where(Startup.slug == slug))
        return bool(self.db.scalar(statement))

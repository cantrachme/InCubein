import uuid

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.mentor import Mentor


class MentorRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: uuid.UUID) -> Mentor | None:
        return self.db.get(Mentor, id)

    def get_by_slug(self, slug: str) -> Mentor | None:
        statement = select(Mentor).where(Mentor.slug == slug)
        return self.db.execute(statement).scalar_one_or_none()

    def list(self, skip: int = 0, limit: int = 100) -> list[Mentor]:
        statement = select(Mentor).offset(skip).limit(limit)
        return list(self.db.execute(statement).scalars().all())

    def create(self, mentor: Mentor) -> Mentor:
        self.db.add(mentor)
        self.db.flush()
        self.db.refresh(mentor)
        return mentor

    def update(self, mentor: Mentor) -> Mentor:
        self.db.add(mentor)
        self.db.flush()
        return mentor

    def delete(self, mentor: Mentor) -> None:
        self.db.delete(mentor)
        self.db.flush()

    def exists_by_slug(self, slug: str) -> bool:
        statement = select(exists().where(Mentor.slug == slug))
        return bool(self.db.scalar(statement))

import uuid

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.investor import Investor


class InvestorRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: uuid.UUID) -> Investor | None:
        return self.db.get(Investor, id)

    def get_by_slug(self, slug: str) -> Investor | None:
        statement = select(Investor).where(Investor.slug == slug)
        return self.db.execute(statement).scalar_one_or_none()

    def list(self, skip: int = 0, limit: int = 100) -> list[Investor]:
        statement = select(Investor).offset(skip).limit(limit)
        return list(self.db.execute(statement).scalars().all())

    def create(self, investor: Investor) -> Investor:
        self.db.add(investor)
        self.db.flush()
        self.db.refresh(investor)
        return investor

    def update(self, investor: Investor) -> Investor:
        self.db.add(investor)
        self.db.flush()
        return investor

    def delete(self, investor: Investor) -> None:
        self.db.delete(investor)
        self.db.flush()

    def exists_by_slug(self, slug: str) -> bool:
        statement = select(exists().where(Investor.slug == slug))
        return bool(self.db.scalar(statement))

import uuid

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.city import City


class CityRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: uuid.UUID) -> City | None:
        return self.db.get(City, id)

    def get_by_state_and_name(
        self,
        state_id: uuid.UUID,
        name: str,
    ) -> City | None:
        statement = select(City).where(
            City.state_id == state_id,
            City.name == name,
        )
        return self.db.execute(statement).scalar_one_or_none()

    def list(self, skip: int = 0, limit: int = 100) -> list[City]:
        statement = select(City).offset(skip).limit(limit)
        return list(self.db.execute(statement).scalars().all())

    def list_by_state(self, state_id: uuid.UUID) -> list[City]:
        statement = select(City).where(City.state_id == state_id)
        return list(self.db.execute(statement).scalars().all())

    def create(self, city: City) -> City:
        self.db.add(city)
        self.db.flush()
        self.db.refresh(city)
        return city

    def update(self, city: City) -> City:
        self.db.add(city)
        self.db.flush()
        return city

    def delete(self, city: City) -> None:
        self.db.delete(city)
        self.db.flush()

    def exists_by_state_and_name(
        self,
        state_id: uuid.UUID,
        name: str,
    ) -> bool:
        statement = select(
            exists().where(
                City.state_id == state_id,
                City.name == name,
            )
        )
        return bool(self.db.scalar(statement))

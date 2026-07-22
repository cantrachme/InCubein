import uuid

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models.state import State


class StateRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: uuid.UUID) -> State | None:
        return self.db.get(State, id)

    def get_by_code(self, country_code: str, code: str) -> State | None:
        statement = select(State).where(
            State.country_code == country_code,
            State.code == code,
        )
        return self.db.execute(statement).scalar_one_or_none()

    def get_by_name(self, country_code: str, name: str) -> State | None:
        statement = select(State).where(
            State.country_code == country_code,
            State.name == name,
        )
        return self.db.execute(statement).scalar_one_or_none()

    def list(self, skip: int = 0, limit: int = 100) -> list[State]:
        statement = select(State).offset(skip).limit(limit)
        return list(self.db.execute(statement).scalars().all())

    def list_by_country(self, country_code: str) -> list[State]:
        statement = select(State).where(State.country_code == country_code)
        return list(self.db.execute(statement).scalars().all())

    def create(self, state: State) -> State:
        self.db.add(state)
        self.db.flush()
        self.db.refresh(state)
        return state

    def update(self, state: State) -> State:
        self.db.add(state)
        self.db.flush()
        return state

    def delete(self, state: State) -> None:
        self.db.delete(state)
        self.db.flush()

    def exists_by_code(self, country_code: str, code: str) -> bool:
        statement = select(
            exists().where(
                State.country_code == country_code,
                State.code == code,
            )
        )
        return bool(self.db.scalar(statement))

    def exists_by_name(self, country_code: str, name: str) -> bool:
        statement = select(
            exists().where(
                State.country_code == country_code,
                State.name == name,
            )
        )
        return bool(self.db.scalar(statement))

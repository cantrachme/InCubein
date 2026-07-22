import uuid

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.enums.relationship import RelationshipEntityType, RelationshipType
from app.models.relationship import Relationship


class RelationshipRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: uuid.UUID) -> Relationship | None:
        return self.db.get(Relationship, id)

    def list(self, skip: int = 0, limit: int = 100) -> list[Relationship]:
        statement = select(Relationship).offset(skip).limit(limit)
        return list(self.db.execute(statement).scalars().all())

    def list_by_source(
        self,
        source_type: RelationshipEntityType,
        source_id: uuid.UUID,
    ) -> list[Relationship]:
        statement = select(Relationship).where(
            Relationship.source_type == source_type,
            Relationship.source_id == source_id,
        )
        return list(self.db.execute(statement).scalars().all())

    def list_by_target_id(
        self,
        target_type: RelationshipEntityType,
        target_id: uuid.UUID,
    ) -> list[Relationship]:
        statement = select(Relationship).where(
            Relationship.target_type == target_type,
            Relationship.target_id == target_id,
        )
        return list(self.db.execute(statement).scalars().all())

    def list_by_target_value(
        self,
        target_type: RelationshipEntityType,
        target_value: str,
    ) -> list[Relationship]:
        statement = select(Relationship).where(
            Relationship.target_type == target_type,
            Relationship.target_value == target_value,
        )
        return list(self.db.execute(statement).scalars().all())

    def create(self, relationship: Relationship) -> Relationship:
        self.db.add(relationship)
        self.db.flush()
        self.db.refresh(relationship)
        return relationship

    def update(self, relationship: Relationship) -> Relationship:
        self.db.add(relationship)
        self.db.flush()
        return relationship

    def delete(self, relationship: Relationship) -> None:
        self.db.delete(relationship)
        self.db.flush()

    def exists_edge(
        self,
        source_type: RelationshipEntityType,
        source_id: uuid.UUID,
        relationship_type: RelationshipType,
        target_type: RelationshipEntityType,
        target_id: uuid.UUID | None = None,
        target_value: str | None = None,
    ) -> bool:
        if (target_id is None) == (target_value is None):
            raise ValueError(
                "Exactly one of target_id or target_value must be provided"
            )

        target_condition = (
            Relationship.target_id == target_id
            if target_id is not None
            else Relationship.target_value == target_value
        )
        statement = select(
            exists().where(
                Relationship.source_type == source_type,
                Relationship.source_id == source_id,
                Relationship.relationship_type == relationship_type,
                Relationship.target_type == target_type,
                target_condition,
            )
        )
        return bool(self.db.scalar(statement))

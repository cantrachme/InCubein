import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums.entity_type import EntityType
from app.enums.source_status import SourceStatus
from app.models.source_record import SourceRecord


class SourceRecordRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: uuid.UUID) -> SourceRecord | None:
        return self.db.get(SourceRecord, id)

    def list(self, skip: int = 0, limit: int = 100) -> list[SourceRecord]:
        statement = select(SourceRecord).offset(skip).limit(limit)
        return list(self.db.execute(statement).scalars().all())

    def create(self, source_record: SourceRecord) -> SourceRecord:
        self.db.add(source_record)
        self.db.flush()
        self.db.refresh(source_record)
        return source_record

    def update(self, source_record: SourceRecord) -> SourceRecord:
        self.db.add(source_record)
        self.db.flush()
        return source_record

    def delete(self, source_record: SourceRecord) -> None:
        self.db.delete(source_record)
        self.db.flush()

    def list_by_entity(
        self,
        entity_type: EntityType,
        entity_id: uuid.UUID,
    ) -> list[SourceRecord]:
        entity_id_column = {
            EntityType.INCUBATOR: SourceRecord.incubator_id,
            EntityType.STARTUP: SourceRecord.startup_id,
            EntityType.MENTOR: SourceRecord.mentor_id,
            EntityType.INVESTOR: SourceRecord.investor_id,
        }[entity_type]
        statement = select(SourceRecord).where(
            SourceRecord.entity_type == entity_type,
            entity_id_column == entity_id,
        )
        return list(self.db.execute(statement).scalars().all())

    def list_by_status(self, status: SourceStatus) -> list[SourceRecord]:
        statement = select(SourceRecord).where(SourceRecord.status == status)
        return list(self.db.execute(statement).scalars().all())

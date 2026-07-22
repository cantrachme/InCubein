import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums.pipeline_status import PipelineStatus
from app.models.pipeline_log import PipelineLog


class PipelineLogRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: uuid.UUID) -> PipelineLog | None:
        return self.db.get(PipelineLog, id)

    def list(self, skip: int = 0, limit: int = 100) -> list[PipelineLog]:
        statement = select(PipelineLog).offset(skip).limit(limit)
        return list(self.db.execute(statement).scalars().all())

    def create(self, pipeline_log: PipelineLog) -> PipelineLog:
        self.db.add(pipeline_log)
        self.db.flush()
        self.db.refresh(pipeline_log)
        return pipeline_log

    def update(self, pipeline_log: PipelineLog) -> PipelineLog:
        self.db.add(pipeline_log)
        self.db.flush()
        return pipeline_log

    def delete(self, pipeline_log: PipelineLog) -> None:
        self.db.delete(pipeline_log)
        self.db.flush()

    def list_by_source_record(
        self,
        source_record_id: uuid.UUID,
    ) -> list[PipelineLog]:
        statement = select(PipelineLog).where(
            PipelineLog.source_record_id == source_record_id
        )
        return list(self.db.execute(statement).scalars().all())

    def list_by_status(self, status: PipelineStatus) -> list[PipelineLog]:
        statement = select(PipelineLog).where(PipelineLog.status == status)
        return list(self.db.execute(statement).scalars().all())

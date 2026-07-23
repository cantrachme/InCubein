import uuid

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.enums.ai_enrichment_status import AIEnrichmentStatus
from app.enums.entity_type import EntityType
from app.models.ai_enrichment import AIEnrichment


class AIEnrichmentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, id: uuid.UUID) -> AIEnrichment | None:
        return self.db.get(AIEnrichment, id)

    def list(self, skip: int = 0, limit: int = 100) -> list[AIEnrichment]:
        statement = select(AIEnrichment).offset(skip).limit(limit)
        return list(self.db.execute(statement).scalars().all())

    def create(self, ai_enrichment: AIEnrichment) -> AIEnrichment:
        self.db.add(ai_enrichment)
        self.db.flush()
        self.db.refresh(ai_enrichment)
        return ai_enrichment

    def update(self, ai_enrichment: AIEnrichment) -> AIEnrichment:
        self.db.add(ai_enrichment)
        self.db.flush()
        return ai_enrichment

    def delete(self, ai_enrichment: AIEnrichment) -> None:
        self.db.delete(ai_enrichment)
        self.db.flush()

    def reassign_incubator(
        self,
        duplicate_id: uuid.UUID,
        canonical_id: uuid.UUID,
    ) -> int:
        if duplicate_id == canonical_id:
            return 0

        statement = (
            update(AIEnrichment)
            .where(AIEnrichment.incubator_id == duplicate_id)
            .values(incubator_id=canonical_id)
            .execution_options(synchronize_session="fetch")
        )
        result = self.db.execute(statement)
        return result.rowcount or 0

    def reassign_startup(
        self,
        duplicate_id: uuid.UUID,
        canonical_id: uuid.UUID,
    ) -> int:
        if duplicate_id == canonical_id:
            return 0

        statement = (
            update(AIEnrichment)
            .where(AIEnrichment.startup_id == duplicate_id)
            .values(startup_id=canonical_id)
            .execution_options(synchronize_session="fetch")
        )
        result = self.db.execute(statement)
        return result.rowcount or 0

    def list_by_entity(
        self,
        entity_type: EntityType,
        entity_id: uuid.UUID,
    ) -> list[AIEnrichment]:
        entity_id_column = {
            EntityType.INCUBATOR: AIEnrichment.incubator_id,
            EntityType.STARTUP: AIEnrichment.startup_id,
            EntityType.MENTOR: AIEnrichment.mentor_id,
            EntityType.INVESTOR: AIEnrichment.investor_id,
        }[entity_type]
        statement = select(AIEnrichment).where(entity_id_column == entity_id)
        return list(self.db.execute(statement).scalars().all())

    def list_by_status(
        self,
        status: AIEnrichmentStatus,
    ) -> list[AIEnrichment]:
        statement = select(AIEnrichment).where(AIEnrichment.status == status)
        return list(self.db.execute(statement).scalars().all())

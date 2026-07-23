import uuid
from collections.abc import Collection

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

    def get_by_identity(
        self,
        entity_type: EntityType,
        entity_id: uuid.UUID,
        provider: str,
        model_name: str,
        enrichment_type: str,
        prompt_version: str | None,
        input_hash: str,
    ) -> AIEnrichment | None:
        entity_id_column = {
            EntityType.INCUBATOR: AIEnrichment.incubator_id,
            EntityType.STARTUP: AIEnrichment.startup_id,
            EntityType.MENTOR: AIEnrichment.mentor_id,
            EntityType.INVESTOR: AIEnrichment.investor_id,
        }[entity_type]
        statement = (
            select(AIEnrichment)
            .where(
                entity_id_column == entity_id,
                AIEnrichment.provider == provider,
                AIEnrichment.model_name == model_name,
                AIEnrichment.enrichment_type == enrichment_type,
                AIEnrichment.prompt_version == prompt_version,
                AIEnrichment.input_hash == input_hash,
            )
            .order_by(
                AIEnrichment.created_at.desc(),
                AIEnrichment.id.desc(),
            )
            .limit(1)
        )
        return self.db.execute(statement).scalar_one_or_none()

    def create_or_update_by_identity(
        self,
        ai_enrichment: AIEnrichment,
    ) -> AIEnrichment:
        entity_references = {
            EntityType.INCUBATOR: ai_enrichment.incubator_id,
            EntityType.STARTUP: ai_enrichment.startup_id,
            EntityType.MENTOR: ai_enrichment.mentor_id,
            EntityType.INVESTOR: ai_enrichment.investor_id,
        }
        populated_references = [
            (entity_type, entity_id)
            for entity_type, entity_id in entity_references.items()
            if entity_id is not None
        ]
        if len(populated_references) != 1:
            raise ValueError(
                "AI enrichment identity requires exactly one canonical entity"
            )

        entity_type, entity_id = populated_references[0]
        existing = self.get_by_identity(
            entity_type=entity_type,
            entity_id=entity_id,
            provider=ai_enrichment.provider,
            model_name=ai_enrichment.model_name,
            enrichment_type=ai_enrichment.enrichment_type,
            prompt_version=ai_enrichment.prompt_version,
            input_hash=ai_enrichment.input_hash,
        )
        if existing is None:
            return self.create(ai_enrichment)

        existing.raw_response = ai_enrichment.raw_response
        existing.parsed_output = ai_enrichment.parsed_output
        existing.confidence = ai_enrichment.confidence
        existing.status = ai_enrichment.status
        existing.processed_at = ai_enrichment.processed_at
        return self.update(existing)

    def list_retryable(
        self,
        statuses: Collection[AIEnrichmentStatus],
        skip: int = 0,
        limit: int = 100,
    ) -> list[AIEnrichment]:
        if not statuses:
            return []

        statement = (
            select(AIEnrichment)
            .where(AIEnrichment.status.in_(statuses))
            .order_by(
                AIEnrichment.created_at,
                AIEnrichment.id,
            )
            .offset(skip)
            .limit(limit)
        )
        return list(self.db.execute(statement).scalars().all())

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

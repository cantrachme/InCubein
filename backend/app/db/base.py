from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy ORM models.
    """
    pass


# Import the central model registry after Base is defined so every mapped table
# is registered whenever Base is imported, including by Alembic.
from app import models as _models  # noqa: E402, F401

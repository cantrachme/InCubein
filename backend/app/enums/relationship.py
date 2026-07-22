from enum import Enum


class RelationshipEntityType(str, Enum):
    INCUBATOR = "Incubator"
    INVESTOR = "Investor"
    MENTOR = "Mentor"
    SECTOR = "Sector"
    STARTUP = "Startup"


class RelationshipType(str, Enum):
    BELONGS_TO_SECTOR = "BELONGS_TO_SECTOR"
    FUNDED = "FUNDED"
    HAS_MENTOR = "HAS_MENTOR"
    INCUBATED = "INCUBATED"

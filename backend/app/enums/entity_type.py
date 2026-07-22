from enum import Enum


class EntityType(str, Enum):
    INCUBATOR = "Incubator"
    INVESTOR = "Investor"
    MENTOR = "Mentor"
    STARTUP = "Startup"

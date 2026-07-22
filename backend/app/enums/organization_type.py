from enum import Enum


class OrganizationType(str, Enum):
    ACADEMIC = "Academic"
    ACADEMIC_COLLAB_PARTNER = "Academic Collab Partner"
    ACADEMIC_INSTITUTION = "Academic Institutions"
    CORPORATE = "Corporate"
    GOVERNMENT = "Government"
    GOVERNMENT_SUPPORT = "Government Support"
    PRIVATE = "Private"
    UNIVERSITY = "University"

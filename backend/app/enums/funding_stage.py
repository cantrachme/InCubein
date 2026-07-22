from enum import Enum


class FundingStage(str, Enum):
    UNKNOWN = "Unknown"
    SEED = "Seed"
    SERIES_B = "Series B"
    SERIES_C = "Series C"
    SERIES_D = "Series D"
    SERIES_E = "Series E"
    SERIES_F = "Series F"
    IPO = "IPO"
    POST_IPO = "Post-IPO"
    CLOSED = "Closed"
    DEAD = "Dead"

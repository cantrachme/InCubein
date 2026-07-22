import hashlib
import json
from typing import Any


def serialize_payload(payload: Any) -> str:
    return json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )


def hash_payload(payload: Any) -> str:
    serialized = serialize_payload(payload)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

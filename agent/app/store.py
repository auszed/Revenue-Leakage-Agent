"""JSON persistence: read-only seed in ``DATA_DIR``, writable ledgers in ``SANDBOX_DIR``.

Ledgers are created lazily as empty lists so the sandbox can be consumed by an API
even before any action is applied.
"""

import json
from pathlib import Path

from app.config import DATA_DIR, SANDBOX_DIR

LEDGERS = (
    "applied_invoices",
    "applied_credit_memos",
    "plan_amendments",
    "audit_log",
)


def read_json(name: str) -> list[dict]:
    """Read a seed data file (without extension) from DATA_DIR."""
    return json.loads((DATA_DIR / f"{name}.json").read_text(encoding="utf-8"))


def _ledger_path(name: str) -> Path:
    if name not in LEDGERS:
        raise ValueError(f"Unknown ledger: {name}")
    return SANDBOX_DIR / f"{name}.json"


def read_ledger(name: str) -> list[dict]:
    """Read a sandbox ledger, returning an empty list if it does not exist yet."""
    path = _ledger_path(name)
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _write_ledger(name: str, rows: list[dict]) -> None:
    SANDBOX_DIR.mkdir(parents=True, exist_ok=True)
    _ledger_path(name).write_text(json.dumps(rows, indent=2), encoding="utf-8")


def append_ledger(name: str, row: dict) -> dict:
    """Append a row to a sandbox ledger and return it."""
    rows = read_ledger(name)
    rows.append(row)
    _write_ledger(name, rows)
    return row


def remove_from_ledger(name: str, id_field: str, id_value: str) -> dict | None:
    """Remove the first row where ``row[id_field] == id_value``; return it or None."""
    rows = read_ledger(name)
    for i, row in enumerate(rows):
        if row.get(id_field) == id_value:
            removed = rows.pop(i)
            _write_ledger(name, rows)
            return removed
    return None

"""The eight agent tools over the billing JSON data.

Read tools query ``/data``. Propose tools return an ``action_draft`` (nothing is
written). Write tools (``apply`` / ``rollback``) pause for human approval via
LangGraph ``interrupt`` and then persist to the ``/sandbox`` ledgers.

Pure write logic lives in ``_apply_draft`` / ``_rollback_action`` so it can be unit
tested without a running graph.
"""

import uuid
from datetime import datetime, timezone

from langchain_core.tools import tool
from langgraph.types import interrupt

from app import store

# --- draft action types -> sandbox ledger + id prefix ---------------------------
_LEDGER_FOR = {
    "make_good_invoice": ("applied_invoices", "invoice_id", "INV-MG"),
    "credit_memo": ("applied_credit_memos", "memo_id", "CM"),
    "plan_amendment": ("plan_amendments", "amendment_id", "AM"),
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _next_id(action_type: str) -> str:
    """Monotonic id based on how many of this action were ever applied (audit is append-only)."""
    _, _, prefix = _LEDGER_FOR[action_type]
    n = sum(1 for e in store.read_ledger("audit_log") if e.get("action_type") == action_type)
    return f"{prefix}-{n + 1:03d}"


# --- read tools -----------------------------------------------------------------
@tool
def load_plan(plan_id: str) -> dict:
    """Load a billing plan by id, including any amendment relationships."""
    plans = store.read_json("billing_plans")
    plan = next((p for p in plans if p["plan_id"] == plan_id), None)
    if plan is None:
        return {"error": f"Plan {plan_id} not found"}
    related = [
        p for p in plans
        if p.get("amends") == plan_id or p["plan_id"] == plan.get("amends")
    ]
    return {"plan": plan, "related_plans": related}


@tool
def query_invoices(
    plan_id: str | None = None,
    customer_name: str | None = None,
    status: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    """Filter invoices by plan_id, customer_name, status, and issue_date range (ISO dates, inclusive)."""
    rows = store.read_json("invoices")
    if plan_id is not None:
        rows = [r for r in rows if r.get("plan_id") == plan_id]
    if customer_name is not None:
        rows = [r for r in rows if r.get("customer_name") == customer_name]
    if status is not None:
        rows = [r for r in rows if r.get("status") == status]
    if start_date is not None:
        rows = [r for r in rows if r.get("issue_date", "") >= start_date]
    if end_date is not None:
        rows = [r for r in rows if r.get("issue_date", "") <= end_date]
    return rows


@tool
def fx_convert(amount: float, from_ccy: str, to_ccy: str, on_date: str) -> dict:
    """Convert an amount between currencies using the rate for the given date."""
    if from_ccy == to_ccy:
        return {"amount": amount, "from": from_ccy, "to": to_ccy, "rate": 1.0,
                "converted": round(amount, 2), "on_date": on_date}
    for r in store.read_json("exchange_rates"):
        if (r["date"] == on_date and r["from_currency"] == from_ccy
                and r["to_currency"] == to_ccy):
            return {"amount": amount, "from": from_ccy, "to": to_ccy, "rate": r["rate"],
                    "converted": round(amount * r["rate"], 2), "on_date": on_date}
    return {"error": f"No {from_ccy}->{to_ccy} rate for {on_date}"}


# --- propose tools (draft only) -------------------------------------------------
def _draft(action_type: str, **fields) -> dict:
    return {"draft_id": f"DRAFT-{uuid.uuid4().hex[:8]}", "action_type": action_type, **fields}


@tool
def propose_make_good_invoice(plan_id: str, amount: float, reason: str) -> dict:
    """Draft a make-good invoice to recover missed/underbilled revenue on a plan."""
    plans = store.read_json("billing_plans")
    plan = next((p for p in plans if p["plan_id"] == plan_id), None)
    currency = plan["currency"] if plan else "USD"
    customer = plan["customer_name"] if plan else None
    return _draft("make_good_invoice", plan_id=plan_id, customer_name=customer,
                  amount=amount, currency=currency, reason=reason)


@tool
def propose_credit_memo(invoice_id: str, amount: float, reason: str) -> dict:
    """Draft a credit memo that reduces what a customer owes on an overbilled invoice."""
    inv = next((i for i in store.read_json("invoices") if i["invoice_id"] == invoice_id), None)
    currency = inv["currency"] if inv else "USD"
    plan_id = inv.get("plan_id") if inv else None
    return _draft("credit_memo", invoice_id=invoice_id, plan_id=plan_id,
                  amount=amount, currency=currency, reason=reason)


@tool
def propose_plan_amendment(plan_id: str, change_set: dict) -> dict:
    """Draft an amendment to a billing plan (e.g. change total_value, cadence, entitlements)."""
    return _draft("plan_amendment", plan_id=plan_id, change_set=change_set)


# --- write logic (pure; used by apply/rollback and by tests) --------------------
def _apply_draft(action_draft: dict) -> dict:
    action_type = action_draft.get("action_type")
    if action_type not in _LEDGER_FOR:
        return {"error": f"Unknown action_type: {action_type}"}
    ledger, id_field, _ = _LEDGER_FOR[action_type]
    action_id = _next_id(action_type)
    record = {k: v for k, v in action_draft.items() if k != "draft_id"}
    record[id_field] = action_id
    record["applied_at"] = _now()
    store.append_ledger(ledger, record)
    store.append_ledger("audit_log", {
        "action_id": action_id, "action_type": action_type, "ledger": ledger,
        "id_field": id_field, "applied_at": record["applied_at"], "record": record,
    })
    return {"status": "applied", "action_id": action_id, "ledger": ledger, "record": record}


def _rollback_action(action_id: str) -> dict:
    entry = next((e for e in store.read_ledger("audit_log")
                  if e.get("action_id") == action_id and e.get("action_type") != "rollback"), None)
    if entry is None:
        return {"error": f"No applied action {action_id} to roll back"}
    removed = store.remove_from_ledger(entry["ledger"], entry["id_field"], action_id)
    store.append_ledger("audit_log", {
        "action_id": action_id, "action_type": "rollback",
        "rolled_back": entry["action_type"], "at": _now(),
    })
    return {"status": "rolled_back", "action_id": action_id, "removed": removed}


# --- write tools (human approval via interrupt) ---------------------------------
@tool
def apply(action_draft: dict) -> dict:
    """Apply a proposed action_draft to the sandbox. Requires human approval."""
    decision = interrupt({"type": "approval_request", "operation": "apply", "action": action_draft})
    if not _approved(decision):
        return {"status": "cancelled", "reason": "not approved by user"}
    return _apply_draft(action_draft)


@tool
def rollback(action_id: str) -> dict:
    """Undo a previously applied action by its action_id. Requires human approval."""
    decision = interrupt({"type": "approval_request", "operation": "rollback", "action_id": action_id})
    if not _approved(decision):
        return {"status": "cancelled", "reason": "not approved by user"}
    return _rollback_action(action_id)


def _approved(decision) -> bool:
    if isinstance(decision, dict):
        return bool(decision.get("approved"))
    return bool(decision)


# --- registry -------------------------------------------------------------------
TOOLS = {
    "load_plan": (load_plan, True),
    "query_invoices": (query_invoices, True),
    "fx_convert": (fx_convert, True),
    "propose_make_good_invoice": (propose_make_good_invoice, False),
    "propose_credit_memo": (propose_credit_memo, False),
    "propose_plan_amendment": (propose_plan_amendment, False),
    "apply": (apply, False),
    "rollback": (rollback, False),
}

WRITE_TOOLS = ("apply", "rollback")


def tool_catalog() -> list[dict]:
    """Catalog for the frontend tool-toggle panel."""
    return [
        {"name": name, "description": t.description, "default_enabled": default}
        for name, (t, default) in TOOLS.items()
    ]


def get_tools(enabled: list[str] | None):
    """Return the tool objects for the enabled names (defaults when None)."""
    if enabled is None:
        enabled = [n for n, (_, d) in TOOLS.items() if d]
    return [TOOLS[n][0] for n in enabled if n in TOOLS]

"""Tool tests: anomaly detection over seed data + apply/rollback round-trip."""

import pytest

from app import store, tools


@pytest.fixture
def sandbox(tmp_path, monkeypatch):
    """Isolate ledger writes to a temp dir."""
    monkeypatch.setattr(store, "SANDBOX_DIR", tmp_path)
    return tmp_path


def test_c1001_september_missing():
    rows = tools.query_invoices.invoke({"plan_id": "C-1001"})
    months = {r["issue_date"][:7] for r in rows}
    assert "2025-09" not in months  # September gap = missed revenue
    assert "2025-08" in months and "2025-10" in months


def test_fx_convert_eur_overbill():
    out = tools.fx_convert.invoke(
        {"amount": 25000, "from_ccy": "EUR", "to_ccy": "USD", "on_date": "2025-09-12"}
    )
    assert out["converted"] == 27000.0  # 25000 EUR billed vs 25000 USD target -> $2k overbill


def test_c1010_underbilled():
    plan = tools.load_plan.invoke({"plan_id": "C-1010"})["plan"]
    invoiced = sum(i["amount_invoiced"] for i in tools.query_invoices.invoke({"plan_id": "C-1010"}))
    assert plan["total_value"] - invoiced == 20000  # annual 120k vs 100k invoiced


def test_apply_then_rollback_roundtrip(sandbox):
    draft = tools.propose_make_good_invoice.invoke(
        {"plan_id": "C-1001", "amount": 8000, "reason": "Missing September 2025 billing"}
    )
    applied = tools._apply_draft(draft)
    assert applied["status"] == "applied"
    action_id = applied["action_id"]
    assert len(store.read_ledger("applied_invoices")) == 1

    result = tools._rollback_action(action_id)
    assert result["status"] == "rolled_back"
    assert store.read_ledger("applied_invoices") == []

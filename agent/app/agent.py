"""LangGraph ReAct agent: memory per session + MLflow tracing.

Write tools pause via ``interrupt`` for human approval; conversation state is kept in
a process-wide ``MemorySaver`` keyed by ``thread_id`` (the session id).
"""

import mlflow
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver

from app.config import MLFLOW_TRACKING_URI, OPENAI_MODEL
from app.tools import get_tools

SYSTEM_PROMPT = """You are a revenue-leakage financial detective for a SaaS billing system.

You compare billing PLANS (contracts) against issued INVOICES to find revenue leakage,
then propose and (after approval) apply corrective actions.

Data facts:
- Plans have total_value, currency, cadence (Monthly/Quarterly/Annual) and start_date.
- Amendments supersede a plan via the `amends` field (e.g. C-1007-A1 amends C-1007).
- Invoices carry amount_invoiced, currency and status. Some may be missing or in a
  different currency than the plan.

Anomaly types and the right corrective action:
- Missing or underbilled revenue -> propose_make_good_invoice.
- Overbilling or FX/pricing errors -> propose_credit_memo. Always use fx_convert to compare
  amounts across currencies (e.g. an invoice billed in EUR vs a USD plan target).
- The contract itself changed (total, cadence, entitlements) -> propose_plan_amendment.

How to work:
- Investigate first with load_plan / query_invoices / fx_convert. Show the evidence and the
  arithmetic behind every conclusion (which invoices exist, which period is missing, the FX math).
- Propose an action only after you have evidence. A proposal is a draft; it is NOT applied.
- Never apply without explicit user approval. When the user agrees, call apply with the draft;
  the system will pause for their confirmation before writing to the sandbox.
- Keep track of the plan/invoices under discussion so you can answer follow-up questions.
- Be concise and precise with figures and currency codes."""

_CHECKPOINTER = MemorySaver()
_mlflow_ready = False


def _setup_mlflow() -> None:
    global _mlflow_ready
    if _mlflow_ready or not MLFLOW_TRACKING_URI:
        return
    try:
        mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
        mlflow.set_experiment("revenue-leakage-agent")
        mlflow.langchain.autolog()
        _mlflow_ready = True
    except Exception:
        # Tracing is best-effort; never block the agent if MLflow is unreachable.
        pass


def build_agent(enabled_tools: list[str] | None):
    """Compile a ReAct agent bound to the enabled tools, sharing the session checkpointer."""
    _setup_mlflow()
    model = ChatOpenAI(model=OPENAI_MODEL)
    return create_agent(
        model,
        get_tools(enabled_tools),
        system_prompt=SYSTEM_PROMPT,
        checkpointer=_CHECKPOINTER,
    )

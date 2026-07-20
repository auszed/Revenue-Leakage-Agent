# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The **Revenue Leakage Agent** — a stateful, conversational AI agent that investigates billing
anomalies (billing plans vs. issued invoices), proposes corrective actions, and applies them to a
writable JSON sandbox with human approval. See `readme.md` for the original challenge brief.

Three containers on one Docker network:
- **frontend** — Next.js chat UI (`:3000`)
- **agent** — FastAPI + LangGraph agent, Python managed with `uv` (`:8000`)
- **mlflow** — MLflow tracking server for tracing agent/tool calls (`:5000`)

LLM: OpenAI `gpt-5.4-mini` via `langchain-openai` (model set with `OPENAI_MODEL`).

## Architecture

- The agent is a **LangGraph ReAct agent** (`create_react_agent`) with a `MemorySaver`
  checkpointer. Conversation memory is per session: `thread_id = session_id`.
- **Human-in-the-loop**: write tools (`apply`, `rollback`) call LangGraph `interrupt()` so the
  graph pauses; the frontend renders an Approve/Reject card and resumes via `POST /approve`
  (`Command(resume=...)`).
- **Tool enablement**: the frontend sends `enabled_tools[]` per request; the backend binds only
  that subset. Read tools default on; propose/write tools are toggled on by the user.
- **Data vs. sandbox**: reads come from `/data` (read-only seed JSON). Applied actions are written
  to `/sandbox` JSON ledgers (`applied_invoices`, `applied_credit_memos`, `plan_amendments`,
  `audit_log`) — kept as JSON so they can be consumed by an API. `rollback` reverses entries via
  `audit_log`.
- **Tracing**: `mlflow.langchain.autolog()` + `MLFLOW_TRACKING_URI=http://mlflow:5000`.

### Agent API (frontend <-> agent contract)
| Method | Path | Body / Notes |
|--------|------|--------------|
| POST | `/chat` | `{session_id, message, enabled_tools[]}` -> `{reply, tool_trace[], pending_approval?}` |
| POST | `/approve` | `{session_id, approved}` -> resumes interrupted run |
| GET | `/tools` | tool catalog + default enablement |
| GET | `/sandbox/{ledger}` | serve a sandbox ledger JSON |
| GET | `/health` | liveness |

### The 8 agent tools (`agent/app/tools.py`)
`load_plan`, `query_invoices`, `fx_convert` (read) · `propose_make_good_invoice`,
`propose_credit_memo`, `propose_plan_amendment` (draft only) · `apply`, `rollback` (write, gated
by approval).

## Data model (`/data`)
- `billing_plans.json` — contracts; amendments link via `amends` (e.g. `C-1007-A1` amends `C-1007`).
- `invoices.json` — issued invoices; `plan_id`, `amount_invoiced`, `currency`, `status`.
- `credit_memos.json` — existing negative adjustments.
- `exchange_rates.json` — FX rates keyed by exact `date` + currency pair.

Reference anomalies (used in tests/verification): C-1001 missing September invoice; C-1007-A1
billed 25,000 EUR (= $27,000 @1.08) vs $25k target; C-1010 annual $120k billed only $100k;
I-9202 orphan invoice with empty `plan_id`.

## Commands

Agent (from `agent/`, uses `uv` — never `pip`/`python3` directly):
```
uv sync                                   # install deps
uv run pytest -q                          # run tool/unit tests
uv run pytest tests/test_tools.py::<name> # single test
uv run uvicorn app.main:app --port 8000   # run API locally
```

Frontend (from `frontend/`):
```
npm install
npm run dev        # dev server on :3000
npm run build
```

Full stack:
```
docker compose up --build   # frontend :3000, agent :8000, mlflow :5000
```

Requires a `.env` (see `.env.example`): `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-5.4-mini`,
`MLFLOW_TRACKING_URI=http://mlflow:5000`, `AGENT_URL=http://agent:8000`.

## Conventions
- Python: `uv` only. Short modules/functions, docstring comments, no emojis in code/logs.
- Prove the root cause before fixing; work incrementally and validate each step.
- Record AI-tool prompts and notable commands in `candidate_prompts.md` (challenge requirement).

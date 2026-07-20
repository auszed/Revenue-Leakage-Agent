"""FastAPI surface for the Revenue Leakage Agent."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langgraph.types import Command
from pydantic import BaseModel

from app import store
from app.agent import build_agent
from app.tools import tool_catalog

app = FastAPI(title="Revenue Leakage Agent")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# Remember the tools enabled per session so /approve rebuilds an identical graph.
_SESSION_TOOLS: dict[str, list[str] | None] = {}


class ChatRequest(BaseModel):
    session_id: str
    message: str
    enabled_tools: list[str] | None = None


class ApproveRequest(BaseModel):
    session_id: str
    approved: bool


def _config(session_id: str) -> dict:
    return {"configurable": {"thread_id": session_id}}


def _serialize(result: dict) -> dict:
    """Turn a graph result into {reply, tool_trace, pending_approval?}."""
    messages = result.get("messages", [])
    tool_trace = []
    for m in messages:
        for call in getattr(m, "tool_calls", None) or []:
            tool_trace.append({"type": "call", "tool": call["name"], "args": call["args"]})
        if m.__class__.__name__ == "ToolMessage":
            tool_trace.append({"type": "result", "tool": m.name, "output": str(m.content)})

    reply = ""
    for m in reversed(messages):
        if m.__class__.__name__ == "AIMessage" and isinstance(m.content, str) and m.content.strip():
            reply = m.content
            break

    out = {"reply": reply, "tool_trace": tool_trace}
    interrupts = result.get("__interrupt__")
    if interrupts:
        out["pending_approval"] = interrupts[0].value
    return out


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/tools")
def tools() -> dict:
    return {"tools": tool_catalog()}


@app.get("/sandbox/{ledger}")
def sandbox(ledger: str) -> list[dict]:
    if ledger not in store.LEDGERS:
        raise HTTPException(404, f"Unknown ledger: {ledger}")
    return store.read_ledger(ledger)


@app.post("/chat")
def chat(req: ChatRequest) -> dict:
    _SESSION_TOOLS[req.session_id] = req.enabled_tools
    agent = build_agent(req.enabled_tools)
    result = agent.invoke(
        {"messages": [{"role": "user", "content": req.message}]}, _config(req.session_id)
    )
    return _serialize(result)


@app.post("/approve")
def approve(req: ApproveRequest) -> dict:
    agent = build_agent(_SESSION_TOOLS.get(req.session_id))
    result = agent.invoke(Command(resume={"approved": req.approved}), _config(req.session_id))
    payload = _serialize(result)
    payload["applied"] = req.approved and "pending_approval" not in payload
    return payload

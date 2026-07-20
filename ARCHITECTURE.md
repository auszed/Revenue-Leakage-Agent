# Revenue Leakage Agent — Architecture

Visual guide to how the app is wired. Diagrams render on GitHub (Mermaid).

## 1. System overview

Three containers on one Docker network, two shared volumes.

```mermaid
flowchart LR
    browser["Browser<br/>localhost:3000"]

    subgraph net["Docker network: revleak-net"]
        frontend["frontend<br/>Next.js · :3000"]
        agent["agent<br/>FastAPI + LangGraph · :8000"]
        mlflow["mlflow<br/>tracking server · :5000"]
    end

    data[("./data<br/>seed JSON (read-only)")]
    sandbox[("./sandbox<br/>ledgers (read-write)")]

    browser -->|HTTP| frontend
    frontend -->|"proxy /api/agent/*<br/>AGENT_URL=http://agent:8000"| agent
    agent -->|"autolog traces<br/>MLFLOW_TRACKING_URI"| mlflow
    agent -->|read| data
    agent -->|read / append| sandbox

    browser -.->|view traces :5000| mlflow
```

| Service  | Host:Container | Role                                   |
|----------|----------------|----------------------------------------|
| frontend | 3000:3000      | Chat UI + tool toggles + approval card |
| agent    | 8000:8000      | Agent API + the 8 tools                |
| mlflow   | 5000:5000      | Tracing UI / tracking store            |

## 2. Chat turn (investigation)

The agent keeps memory per session via `thread_id = session_id`.

```mermaid
sequenceDiagram
    actor U as User
    participant F as frontend
    participant A as agent (LangGraph)
    participant L as OpenAI (gpt-5.4-mini)
    participant D as /data + /sandbox
    participant M as mlflow

    U->>F: "Check plan C-1001 for revenue leakage"
    F->>A: POST /chat {session_id, message, enabled_tools[]}
    A->>L: prompt + enabled tools
    L-->>A: tool call: load_plan / query_invoices
    A->>D: read plan + invoices
    D-->>A: JSON
    A->>L: tool results
    L-->>A: final answer (missing September = $8k)
    A-->>M: trace run + tool calls
    A-->>F: {reply, tool_trace}
    F-->>U: renders answer + tool steps
```

## 3. Propose → Apply (human-in-the-loop)

Write tools pause the graph with `interrupt()`; nothing is written until the user approves.

```mermaid
sequenceDiagram
    actor U as User
    participant F as frontend
    participant A as agent (LangGraph)
    participant S as /sandbox

    U->>F: "Create a make-good invoice for September"
    F->>A: POST /chat (apply enabled)
    A->>A: propose_make_good_invoice -> action_draft
    A->>A: apply(draft) -> interrupt(approval_request)
    A-->>F: {reply, pending_approval}
    F-->>U: Approval card (Approve / Reject)

    alt Approve
        U->>F: click Approve
        F->>A: POST /approve {approved:true}
        A->>S: append applied_invoices + audit_log
        A-->>F: {reply, applied:true}
    else Reject
        U->>F: click Reject
        F->>A: POST /approve {approved:false}
        A-->>F: {reply: cancelled}
    end
```

## 4. Tools and data

```mermaid
flowchart TD
    subgraph read["Read (default on)"]
        t1[load_plan]
        t2[query_invoices]
        t3[fx_convert]
    end
    subgraph propose["Propose — draft only (user-enabled)"]
        t4[propose_make_good_invoice]
        t5[propose_credit_memo]
        t6[propose_plan_amendment]
    end
    subgraph write["Write — approval required (user-enabled)"]
        t7[apply]
        t8[rollback]
    end

    t1 & t2 & t3 --> DATA[("/data seed JSON")]
    t4 & t5 & t6 --> DRAFT["action_draft (in memory)"]
    DRAFT --> t7
    t7 --> LEDGER[("/sandbox ledgers + audit_log")]
    t8 --> LEDGER
```

## 5. Endpoint contract

| Method | Path                | Body / Notes                                                  |
|--------|---------------------|--------------------------------------------------------------|
| POST   | `/chat`             | `{session_id, message, enabled_tools[]}` → `{reply, tool_trace[], pending_approval?}` |
| POST   | `/approve`          | `{session_id, approved}` → resumes the interrupted run        |
| GET    | `/tools`            | tool catalog + default enablement                            |
| GET    | `/sandbox/{ledger}` | `applied_invoices` \| `applied_credit_memos` \| `plan_amendments` \| `audit_log` |
| GET    | `/health`           | liveness                                                     |

## 6. Run

```bash
cp .env.example .env   # set OPENAI_API_KEY
docker compose up --build
# frontend  http://localhost:3000
# agent     http://localhost:8000/health
# mlflow    http://localhost:5000
```

# Candidate AI Tool Usage Log

**Instructions for Candidates:**
Please document all prompts you use with AI tools during this challenge. This helps us understand your problem-solving approach and AI tool utilization skills.

---

## Build Command Log (running)

Tool used: **Claude Code (Opus 4.8)**. Commands run during the build, in order.

| # | Step | Command | Purpose |
|---|------|---------|---------|
| 1 | 0 | `/init` | Generate `CLAUDE.md` documenting the repo |
| 2 | 1 | `uv init agent --bare --no-workspace` | Create the agent uv project |
| 3 | 1 | `uv add langchain langchain-openai langgraph fastapi "uvicorn[standard]" mlflow python-dotenv pydantic` | Add agent deps (latest) |
| 4 | 3 | `uv add --dev pytest` | Add test dependency |
| 5 | 2-5 | `uv run python -c "..."` | Smoke-check store/config/agent/app imports |
| 6 | 3 | `uv run pytest -q` | Run tool unit tests (4 anomalies + apply/rollback) |
| 7 | 6 | `npm install` (frontend) | Install Next.js deps |
| 8 | 6 | `npm run build` (frontend) | Type-check + build the UI |
| 9 | 8 | `docker compose config --quiet` | Validate compose file |
| 10 | 9 | `docker compose up -d --build` | Build images and start the stack |
| 11 | 9 | `curl 127.0.0.1:8000/health` `/tools` `/sandbox/{ledger}` | Verify agent endpoints (IPv4; localhost resolved to IPv6 and failed) |
| 12 | 9 | `POST /chat` C-1001 + `POST /approve` | Live investigate -> propose -> approve -> sandbox write (INV-MG-001) |
| 13 | 9 | `POST /chat` rollback + `POST /approve` | Rollback -> ledger reversed to [] |
| 14 | 9 | Set `MLFLOW_SERVER_ALLOWED_HOSTS=*` on mlflow service | Fix MLflow 3.x 403 "Invalid Host header" so traces are captured |

### Verification results
- 3 containers up (frontend :3000, agent :8000, mlflow :5000).
- Anomaly detection: C-1001 missing September ($8k), C-1010 annual $120k vs $100k.
- Human-in-the-loop: apply/rollback pause via LangGraph interrupt; approval writes to sandbox.
- Stateful memory: follow-up recalled plan currency + applied invoice id.
- MLflow: agent runs traced to experiment `revenue-leakage-agent`.

---

## AI Tool Usage Log

### Prompt 1
**Tool Used:** [e.g., ChatGPT, Claude, GitHub Copilot, Cursor, etc.]
**Context:** [What were you trying to accomplish?]
**Prompt:**
```
[Paste your exact prompt here]
```

**Result:** [Brief description of what the AI provided]
**Follow-up:** [Any follow-up prompts or iterations]

---

### Prompt 2
**Tool Used:** [e.g., ChatGPT, Claude, GitHub Copilot, Cursor, etc.]
**Context:** [What were you trying to accomplish?]
**Prompt:**
```
[Paste your exact prompt here]
```

**Result:** [Brief description of what the AI provided]
**Follow-up:** [Any follow-up prompts or iterations]

---

### Prompt 3
**Tool Used:** [e.g., ChatGPT, Claude, GitHub Copilot, Cursor, etc.]
**Context:** [What were you trying to accomplish?]
**Prompt:**
```
[Paste your exact prompt here]
```

**Result:** [Brief description of what the AI provided]
**Follow-up:** [Any follow-up prompts or iterations]

---

### Prompt 4
**Tool Used:** [e.g., ChatGPT, Claude, GitHub Copilot, Cursor, etc.]
**Context:** [What were you trying to accomplish?]
**Prompt:**
```
[Paste your exact prompt here]
```

**Result:** [Brief description of what the AI provided]
**Follow-up:** [Any follow-up prompts or iterations]

---

### Prompt 5
**Tool Used:** [e.g., ChatGPT, Claude, GitHub Copilot, Cursor, etc.]
**Context:** [What were you trying to accomplish?]
**Prompt:**
```
[Paste your exact prompt here]
```

**Result:** [Brief description of what the AI provided]
**Follow-up:** [Any follow-up prompts or iterations]

---

**Note:** Add more prompt sections as needed. The goal is to capture your complete AI tool usage pattern during this challenge.

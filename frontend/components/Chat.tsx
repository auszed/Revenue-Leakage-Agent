"use client";

import { useEffect, useRef, useState } from "react";
import { getTools, sendChat, sendApproval, type ToolInfo, type TraceItem, type Draft } from "@/lib/api";
import ToolPanel from "./ToolPanel";
import ApprovalCard from "./ApprovalCard";
import ProposalCard from "./ProposalCard";
import ToolTrace from "./ToolTrace";

type Msg = { role: "user" | "assistant"; content: string; trace?: TraceItem[] };

const genUser = () => `u-${Math.random().toString(36).slice(2, 8)}`;

// Find a fresh propose_* draft in a response's tool trace (for the Accept card).
function findProposal(trace: TraceItem[]): Draft | null {
  for (let i = trace.length - 1; i >= 0; i--) {
    const it = trace[i];
    if (it.type === "result" && it.tool.startsWith("propose_") && it.output) {
      try {
        const draft = JSON.parse(it.output) as Draft;
        if (draft.action_type) return draft;
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

export default function Chat() {
  const [userId, setUserId] = useState(genUser);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Msg[]>([]);
  const [approval, setApproval] = useState<any>(null);
  const [proposal, setProposal] = useState<Draft | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTools().then((ts) => {
      setTools(ts);
      setEnabled(Object.fromEntries(ts.map((t) => [t.name, true]))); // all tools on by default
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, approval, proposal]);

  const enabledNames = () => Object.keys(enabled).filter((n) => enabled[n]);

  function absorb(res: { reply: string; tool_trace: TraceItem[]; pending_approval?: unknown }) {
    setMessages((m) => [...m, { role: "assistant", content: res.reply, trace: res.tool_trace }]);
    setApproval(res.pending_approval ?? null);
    // Surface an Accept card only when there is a proposal and no approval pending.
    setProposal(res.pending_approval ? null : findProposal(res.tool_trace));
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setProposal(null);
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      absorb(await sendChat(userId, text, enabledNames()));
    } finally {
      setBusy(false);
    }
  }

  async function acceptProposal(draft: Draft) {
    setProposal(null);
    setBusy(true);
    const ref = draft.plan_id ?? draft.invoice_id ?? "";
    const msg = `Apply the proposed ${draft.action_type} ${ref}.`.trim();
    setMessages((m) => [...m, { role: "user", content: "Accept proposal" }]);
    try {
      absorb(await sendChat(userId, msg, enabledNames()));
    } finally {
      setBusy(false);
    }
  }

  function newUser() {
    setUserId(genUser());
    setMessages([]);
    setApproval(null);
    setProposal(null);
    setInput("");
  }

  async function decide(approved: boolean) {
    setBusy(true);
    setApproval(null);
    try {
      absorb(await sendApproval(userId, approved));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="layout">
      <ToolPanel
        tools={tools}
        enabled={enabled}
        onToggle={(n) => setEnabled((e) => ({ ...e, [n]: !e[n] }))}
      />
      <main className="chat">
        <header className="chat-header">
          <h1>Revenue Leakage Agent</h1>
          <div className="header-right">
            <span className="user-chip">user: {userId}</span>
            <button className="btn-ghost" onClick={newUser} disabled={busy}>
              New test user
            </button>
          </div>
        </header>
        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="bubble">{m.content || <em>(no text)</em>}</div>
              {m.trace && m.trace.length > 0 && <ToolTrace items={m.trace} />}
            </div>
          ))}
          {proposal && approval == null && (
            <ProposalCard draft={proposal} onAccept={acceptProposal} onDismiss={() => setProposal(null)} busy={busy} />
          )}
          {approval != null && <ApprovalCard approval={approval} onDecision={decide} busy={busy} />}
          {busy && <div className="thinking">thinking...</div>}
          <div ref={endRef} />
        </div>
        <div className="composer">
          <input
            value={input}
            placeholder="e.g. Check plan C-1001 for revenue leakage"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={busy}
          />
          <button onClick={send} disabled={busy}>
            Send
          </button>
        </div>
      </main>
    </div>
  );
}

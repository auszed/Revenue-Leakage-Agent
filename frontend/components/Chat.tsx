"use client";

import { useEffect, useRef, useState } from "react";
import { getTools, sendChat, sendApproval, type ToolInfo, type TraceItem } from "@/lib/api";
import ToolPanel from "./ToolPanel";
import ApprovalCard from "./ApprovalCard";

type Msg = { role: "user" | "assistant"; content: string; trace?: TraceItem[] };

export default function Chat() {
  const sessionId = useRef(`s-${Math.random().toString(36).slice(2)}`);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Msg[]>([]);
  const [approval, setApproval] = useState<unknown>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTools().then((ts) => {
      setTools(ts);
      setEnabled(Object.fromEntries(ts.map((t) => [t.name, t.default_enabled])));
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, approval]);

  const enabledNames = () => Object.keys(enabled).filter((n) => enabled[n]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await sendChat(sessionId.current, text, enabledNames());
      setMessages((m) => [...m, { role: "assistant", content: res.reply, trace: res.tool_trace }]);
      setApproval(res.pending_approval ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function decide(approved: boolean) {
    setBusy(true);
    setApproval(null);
    try {
      const res = await sendApproval(sessionId.current, approved);
      setMessages((m) => [...m, { role: "assistant", content: res.reply, trace: res.tool_trace }]);
      setApproval(res.pending_approval ?? null);
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
        <h1>Revenue Leakage Agent</h1>
        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="bubble">{m.content || <em>(no text)</em>}</div>
              {m.trace && m.trace.length > 0 && (
                <details className="trace">
                  <summary>{m.trace.length} tool step(s)</summary>
                  <pre>{JSON.stringify(m.trace, null, 2)}</pre>
                </details>
              )}
            </div>
          ))}
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

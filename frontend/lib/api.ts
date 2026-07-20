// Typed client for the agent, via the Next.js proxy at /api/agent/*.

export type ToolInfo = { name: string; description: string; default_enabled: boolean };
export type TraceItem = { type: "call" | "result"; tool: string; args?: unknown; output?: string };

// A proposed or applied corrective action (draft has draft_id; applied record has an id + applied_at).
export type Draft = {
  draft_id?: string;
  action_type: string;
  plan_id?: string;
  invoice_id?: string;
  memo_id?: string;
  amendment_id?: string;
  customer_name?: string;
  amount?: number;
  currency?: string;
  reason?: string;
  change_set?: Record<string, unknown>;
  applied_at?: string;
};
export type ChatResponse = {
  reply: string;
  tool_trace: TraceItem[];
  pending_approval?: unknown;
  applied?: boolean;
};

async function post(path: string, body: unknown): Promise<ChatResponse> {
  const res = await fetch(`/api/agent/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getTools(): Promise<ToolInfo[]> {
  const res = await fetch("/api/agent/tools");
  const data = await res.json();
  return data.tools;
}

export function sendChat(session_id: string, message: string, enabled_tools: string[]) {
  return post("chat", { session_id, message, enabled_tools });
}

export function sendApproval(session_id: string, approved: boolean) {
  return post("approve", { session_id, approved });
}

// Typed client for the agent, via the Next.js proxy at /api/agent/*.

export type ToolInfo = { name: string; description: string; default_enabled: boolean };
export type TraceItem = { type: "call" | "result"; tool: string; args?: unknown; output?: string };
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

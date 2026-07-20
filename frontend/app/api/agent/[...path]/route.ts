// Server-side proxy to the agent backend so AGENT_URL stays server-only (no CORS).
const AGENT_URL = process.env.AGENT_URL || "http://localhost:8000";

async function proxy(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = `${AGENT_URL}/${path.join("/")}`;
  const init: RequestInit = { method: req.method, headers: { "content-type": "application/json" } };
  if (req.method !== "GET") init.body = await req.text();
  const res = await fetch(target, init);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}

export const GET = proxy;
export const POST = proxy;

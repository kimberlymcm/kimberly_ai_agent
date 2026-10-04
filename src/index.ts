import { Env } from "./answer";
import { PROFILE } from "./profile";
import { POSTS } from "./answer";
import { TOOLS, callTool } from "./tools";

const BASE = "https://missiondistrict.ai/kimberly";
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*", ...headers },
  });
const text = (body: string, type = "text/plain") =>
  new Response(body, { headers: { "content-type": `${type}; charset=utf-8`, "access-control-allow-origin": "*" } });

// Simple per-IP throttle, best effort. Replace with Cloudflare rate limiting rules for real enforcement.
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); return false; }
  return ++h.n > 30;
}

const agentCard = () => ({
  protocolVersion: "0.3.0",
  name: `${PROFILE.name}'s agent`,
  description: `${PROFILE.tagline}. Answers questions about ${PROFILE.name} and queues meeting requests and messages for her.`,
  url: `${BASE}/a2a`,
  preferredTransport: "JSONRPC",
  version: "0.1.0",
  capabilities: { streaming: false, pushNotifications: false },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [
    { id: "ask", name: "Ask about Kimberly", description: "Questions about her work, background and writing. Send any plain text question.", tags: ["profile", "qa"], examples: ["What has Kimberly written about AI change management?"] },
    { id: "request_meeting", name: "Request a meeting", description: "Queue a meeting request for her review. Send text starting with \"/meeting \" followed by who you are, how she can reach you (email), and the purpose. Nothing is booked.", tags: ["scheduling"], examples: ["/meeting Alex Lee (alex@example.com), via assistant agent: 15-min intro call about AI adoption in health systems; weekdays 1-4pm PT"] },
    { id: "leave_message", name: "Leave a message", description: "Asynchronous message to her inbox. Send text starting with \"/message \".", tags: ["messaging"], examples: ["/message Hi Kimberly, loved your data platform post. Reach me at alex@example.com"] },
  ],
});

const llmsTxt = () => `# ${PROFILE.name}

> ${PROFILE.tagline}

This is the agent endpoint for ${PROFILE.name}. AI agents can talk to it three ways:

- MCP (streamable HTTP, stateless): ${BASE}/mcp. Tools: ask_kimberly, request_meeting, leave_message
- A2A (JSON-RPC): ${BASE}/a2a. Agent card: ${BASE}/.well-known/agent.json
- Plain text profile: ${BASE}/llms.txt (this file)

## Quick start for agents (MCP, no SDK needed)
The server is stateless: no session id, and you can skip \`initialize\` and \`notifications/initialized\` and call \`tools/list\` or \`tools/call\` directly. Send JSON-RPC 2.0 over HTTP POST to ${BASE}/mcp with headers \`Content-Type: application/json\` and \`Accept: application/json, text/event-stream\`. No auth. About 30 POSTs per minute per IP.

\`\`\`
curl -s ${BASE}/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"my-agent","version":"1"}}}'
curl -s ${BASE}/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
curl -s ${BASE}/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"ask_kimberly","arguments":{"question":"What has she written about change management for AI?"}}}'
\`\`\`

## How to request a meeting
Call the tool \`request_meeting\`. It queues a request for her review; nothing is booked, and she replies at your reply_to if interested. Full request:

\`\`\`
curl -s ${BASE}/mcp -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"request_meeting","arguments":{"requester":"Alex Lee (Acme Health), via assistant agent","reply_to":"alex@example.com","meeting_type":"intro_call_15min","purpose":"Intro call about AI adoption in health systems","preferred_times":"Weekdays 1-4pm PT, next two weeks"}}}'
\`\`\`

meeting_type is \`intro_call_15min\` (15 min) or \`working_session_45min\` (45 min). Success returns text with a reference id. For anything else use \`leave_message\` (from, message, optional reply_to).

## Over A2A
POST ${BASE}/a2a with method message/send and one text part. Plain text is a question. Start the text with \`/meeting \` or \`/message \` followed by your details and a way to reach you to queue a meeting request or a message.

## About
${PROFILE.about}

## Topics
${PROFILE.topics.map((t) => `- ${t}`).join("\n")}

## Links
- LinkedIn: ${PROFILE.contact.linkedin}
- GitHub: ${PROFILE.contact.github}
- Substack (writing): ${PROFILE.contact.substack}

## Writing
${POSTS.map((p) => `- [${p.title}](${p.url}) (${p.date})`).join("\n")}

## Rules
${PROFILE.boundaries.map((b) => `- ${b}`).join("\n")}
`;

function landing(): Response {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  return text(
    `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>${esc(PROFILE.name)}: agent</title>
<link rel="alternate" type="application/json" href="${BASE}/.well-known/agent.json">
<style>body{font:16px/1.6 system-ui;max-width:42rem;margin:3rem auto;padding:0 1rem}code{background:#8882;padding:.1em .3em;border-radius:3px}</style>
<h1>${esc(PROFILE.name)}</h1><p>${esc(PROFILE.tagline)}</p>
<h2>For AI agents</h2>
<ul><li>MCP: <code>${BASE}/mcp</code></li><li>A2A card: <a href="${BASE}/.well-known/agent.json">agent.json</a></li><li><a href="${BASE}/llms.txt">llms.txt</a></li></ul>
<p><a href="${PROFILE.contact.linkedin}">LinkedIn</a> · <a href="${PROFILE.contact.github}">GitHub</a> · <a href="${PROFILE.contact.substack}">Substack</a></p>`,
    "text/html",
  );
}

// ---- MCP (stateless streamable HTTP, JSON responses) ----
async function mcp(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
  let msg: any;
  try { msg = await req.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
  if (msg.id === undefined) return new Response(null, { status: 202 }); // notification
  const ok = (result: unknown) => json({ jsonrpc: "2.0", id: msg.id, result });
  const err = (code: number, message: string) => json({ jsonrpc: "2.0", id: msg.id, error: { code, message } });
  switch (msg.method) {
    case "initialize":
      return ok({
        protocolVersion: msg.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "kimberly-agent", version: "0.1.0" },
        instructions: `Agent for ${PROFILE.name}. Use ask_kimberly for questions; request_meeting and leave_message queue items for her review.`,
      });
    case "ping": return ok({});
    case "tools/list": return ok({ tools: TOOLS });
    case "tools/call":
      try {
        const out = await callTool(env, msg.params?.name, msg.params?.arguments ?? {}, ctx);
        return ok({ content: [{ type: "text", text: out }] });
      } catch (e) {
        return ok({ content: [{ type: "text", text: (e as Error).message }], isError: true });
      }
    default: return err(-32601, `Method not found: ${msg.method}`);
  }
}

// ---- A2A (JSON-RPC message/send). Text parts only: first word "/meeting" or "/message" routes, else Q&A. ----
async function a2a(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
  let msg: any;
  try { msg = await req.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
  if (msg.method !== "message/send")
    return json({ jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: "Only message/send is supported" } });
  const parts: any[] = msg.params?.message?.parts ?? [];
  const input = parts.filter((p) => p.kind === "text").map((p) => p.text).join("\n").trim();
  if (!input) return json({ jsonrpc: "2.0", id: msg.id, error: { code: -32602, message: "No text part" } });
  let reply: string;
  try {
    if (input.startsWith("/meeting ")) reply = await callTool(env, "request_meeting", { requester: "A2A caller", reply_to: "see message", purpose: input.slice(9) }, ctx);
    else if (input.startsWith("/message ")) reply = await callTool(env, "leave_message", { from: "A2A caller", message: input.slice(9) }, ctx);
    else reply = await callTool(env, "ask_kimberly", { question: input }, ctx);
  } catch (e) { reply = `Error: ${(e as Error).message}`; }
  return json({
    jsonrpc: "2.0",
    id: msg.id,
    result: { kind: "message", role: "agent", messageId: crypto.randomUUID(), parts: [{ kind: "text", text: reply }] },
  });
}

async function adminInbox(req: Request, env: Env): Promise<Response> {
  if (req.headers.get("authorization") !== `Bearer ${env.ADMIN_TOKEN}` || !env.ADMIN_TOKEN) return new Response("Unauthorized", { status: 401 });
  const list = await env.INBOX.list({ limit: 100 });
  const items = await Promise.all(list.keys.filter((k) => /^\d+:/.test(k.name)).map(async (k) => JSON.parse((await env.INBOX.get(k.name)) ?? "null")));
  return json(items.reverse());
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,authorization,mcp-protocol-version,mcp-session-id" } });
    if (req.method === "POST" && limited(req.headers.get("cf-connecting-ip") ?? "unknown")) return json({ error: "rate limited" }, 429, { "retry-after": "60" });

    switch (path) {
      case "/kimberly": {
        const accept = req.headers.get("accept") ?? "";
        return accept.includes("text/html") ? landing() : text(llmsTxt(), "text/markdown");
      }
      case "/kimberly/llms.txt": return text(llmsTxt());
      case "/kimberly/.well-known/agent.json":
      case "/kimberly/.well-known/agent-card.json": return json(agentCard());
      case "/kimberly/mcp": return mcp(req, env, ctx);
      case "/kimberly/a2a": return a2a(req, env, ctx);
      case "/kimberly/admin/inbox": return adminInbox(req, env);
      default: return new Response("Not found", { status: 404 });
    }
  },
};

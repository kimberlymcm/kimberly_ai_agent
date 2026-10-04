import { answer, Env } from "./answer";
import { PROFILE } from "./profile";
import { noteQuestion, sendAlert } from "./notify";

export const TOOLS = [
  {
    name: "ask_kimberly",
    description: `Ask a question about ${PROFILE.name}: her work, background, interests, and Substack writing. Answers come from her curated profile and posts, and link to relevant posts. Returns plain text. To schedule a call use request_meeting, not this tool.`,
    inputSchema: {
      type: "object",
      properties: { question: { type: "string", maxLength: 2000 } },
      required: ["question"],
    },
  },
  {
    name: "request_meeting",
    description: `Request a meeting with ${PROFILE.name}. This queues a request for her review; it does not book or confirm anything, and she replies at reply_to if interested. Returns a confirmation with a reference id. Required: requester, reply_to, purpose.`,
    inputSchema: {
      type: "object",
      properties: {
        requester: { type: "string", description: "Who is asking (person/org and the agent acting for them)" },
        reply_to: { type: "string", description: "Required. Monitored email or URL where Kimberly can respond; this is the only way she can reach you" },
        meeting_type: { type: "string", enum: ["intro_call_15min", "working_session_45min"], description: "intro_call_15min (default) or working_session_45min" },
        purpose: { type: "string", maxLength: 2000 },
        preferred_times: { type: "string", description: "Windows with timezone" },
      },
      required: ["requester", "reply_to", "purpose"],
    },
  },
  {
    name: "leave_message",
    description: `Leave an asynchronous message for ${PROFILE.name} (not for scheduling; use request_meeting for that). Returns a confirmation with a reference id. reply_to is optional here, but without it she cannot answer. Rate limit: about 30 requests per minute per IP.`,
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Who is writing (person/org and the agent acting for them)" },
        reply_to: { type: "string", description: "Optional. Email or URL for a reply" },
        message: { type: "string", maxLength: 4000 },
      },
      required: ["from", "message"],
    },
  },
] as const;

async function enqueue(env: Env, kind: string, body: Record<string, unknown>) {
  const id = crypto.randomUUID();
  const clean = Object.fromEntries(
    Object.entries(body).map(([k, v]) => [k, String(v ?? "").slice(0, 4000)]),
  );
  await env.INBOX.put(`${Date.now()}:${id}`, JSON.stringify({ id, kind, at: new Date().toISOString(), ...clean }), {
    expirationTtl: 60 * 60 * 24 * 90,
  });
  return id;
}

const formatItem = (a: Record<string, unknown>) =>
  Object.entries(a).map(([k, v]) => `${k}: ${String(v).slice(0, 2000)}`).join("\n");

// Returns plain text for any tool; throws on unknown tool or bad args.
export async function callTool(env: Env, name: string, args: Record<string, unknown>, ctx: ExecutionContext): Promise<string> {
  switch (name) {
    case "ask_kimberly": {
      if (typeof args.question !== "string" || !args.question) throw new Error("question is required");
      ctx.waitUntil(noteQuestion(env, args.question));
      return answer(env, args.question);
    }
    case "request_meeting": {
      for (const k of ["requester", "reply_to", "purpose"]) if (!args[k]) throw new Error(`${k} is required`);
      const id = await enqueue(env, "meeting", args);
      ctx.waitUntil(sendAlert(env, `Meeting request from ${String(args.requester).slice(0, 80)}`, formatItem(args)));
      return `Meeting request queued (ref ${id}). Kimberly will review it and respond at the reply_to you gave. Nothing is booked yet.`;
    }
    case "leave_message": {
      if (!args.from || !args.message) throw new Error("from and message are required");
      const id = await enqueue(env, "message", args);
      ctx.waitUntil(sendAlert(env, `Message from ${String(args.from).slice(0, 80)}`, formatItem(args)));
      return `Message delivered to Kimberly's inbox (ref ${id}).`;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

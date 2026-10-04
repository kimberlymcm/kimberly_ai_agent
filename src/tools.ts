import { answer, Env } from "./answer";
import { PROFILE } from "./profile";
import { noteQuestion, sendAlert } from "./notify";

export const TOOLS = [
  {
    name: "ask_kimberly",
    description: `Ask a question about ${PROFILE.name}: her work, background, and interests. Answers come from her curated profile.`,
    inputSchema: {
      type: "object",
      properties: { question: { type: "string", maxLength: 2000 } },
      required: ["question"],
    },
  },
  {
    name: "request_meeting",
    description: `Request a meeting with ${PROFILE.name}. This queues a request for her review; it does not book anything. Types: ${PROFILE.meetingTypes.join("; ")}.`,
    inputSchema: {
      type: "object",
      properties: {
        requester: { type: "string", description: "Who is asking (person/org and the agent acting for them)" },
        reply_to: { type: "string", description: "Email or URL where Kimberly can respond" },
        meeting_type: { type: "string" },
        purpose: { type: "string", maxLength: 2000 },
        preferred_times: { type: "string", description: "Windows with timezone" },
      },
      required: ["requester", "reply_to", "purpose"],
    },
  },
  {
    name: "leave_message",
    description: `Leave an asynchronous message for ${PROFILE.name}.`,
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        reply_to: { type: "string" },
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

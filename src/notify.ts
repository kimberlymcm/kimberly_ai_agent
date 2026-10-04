import { Env } from "./answer";

// Sends a plain-text alert via Resend. Never throws: a failed alert must not break the caller's reply.
export async function sendAlert(env: Env, subject: string, body: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.ALERT_TO) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.ALERT_FROM || "Kimberly Agent <agent@missiondistrict.ai>",
        to: [env.ALERT_TO],
        subject,
        text: body,
      }),
    });
    if (!res.ok) console.error("Resend", res.status, await res.text());
  } catch (e) {
    console.error("Resend failed", e);
  }
}

const QUESTION_WINDOW_SECONDS = 3600;

// Questions are batched: the first one after a quiet hour sends a digest of everything pending,
// then alerts pause for an hour. Questions that arrive during the pause wait for the next alert.
export async function noteQuestion(env: Env, question: string): Promise<void> {
  const pending: { at: string; q: string }[] = JSON.parse((await env.INBOX.get("pending:questions")) ?? "[]");
  pending.push({ at: new Date().toISOString(), q: question.slice(0, 500) });
  const recent = pending.slice(-20);
  if (await env.INBOX.get("throttle:questions")) {
    await env.INBOX.put("pending:questions", JSON.stringify(recent), { expirationTtl: 60 * 60 * 24 });
    return;
  }
  await env.INBOX.put("throttle:questions", "1", { expirationTtl: QUESTION_WINDOW_SECONDS });
  await env.INBOX.delete("pending:questions");
  await sendAlert(
    env,
    `Kimberly agent: ${recent.length} question${recent.length === 1 ? "" : "s"} asked`,
    recent.map((p) => `${p.at}\n${p.q}`).join("\n\n"),
  );
}

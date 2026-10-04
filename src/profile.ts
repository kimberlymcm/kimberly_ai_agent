// Edit this file: it is the only source of truth the agent answers from.
export const PROFILE = {
  name: "Kimberly McManus",
  tagline: "TODO: one-line description of what you do",
  about: `TODO: a few paragraphs about your background, current work, and interests.`,
  topics: ["TODO: topic 1", "TODO: topic 2"],
  contact: { site: "https://missiondistrict.ai/kimberly" },
  meetingTypes: ["intro call (15 min)", "working session (45 min)"],
  // Things the agent must never share or do.
  boundaries: [
    "Never share private contact details, calendar contents, or anything not in this profile.",
    "Never commit Kimberly to anything; meeting and message requests are only queued for her review.",
  ],
};

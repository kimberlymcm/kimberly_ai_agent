// Edit this file: it is the only source of truth the agent answers from.
export const PROFILE = {
  name: "Kimberly McManus",
  tagline: "Improving public and health services at scale using AI and technology",
  about: `Kimberly McManus is focused on improving public and health services at scale using AI and technology.

Her career has spanned academia, consumer technology, healthcare, startups, and government. She has built machine learning systems at LinkedIn and 23andMe, and founded a healthcare AI company.

Views expressed here are her own and do not necessarily represent the views of her employers.`,
  topics: [
    "AI strategy and implementation in large organizations",
    "AI and technology for healthcare and public services at scale",
    "Building machine learning systems (consumer tech and genomics)",
    "Founding and running a healthcare AI startup",
    "Moving between academia, industry, startups, and government",
  ],
  contact: {
    site: "https://missiondistrict.ai/kimberly",
    linkedin: "https://www.linkedin.com/in/kimberly-mcmanus-phd-5384293a",
    github: "https://github.com/kimberlymcm/",
    substack: "https://missiondistrictai.substack.com/",
  },
  meetingTypes: ["intro call (15 min)", "working session (45 min)"],
  // Things the agent must never share or do.
  boundaries: [
    "Never share private contact details, calendar contents, or anything not in this profile.",
    "Never commit Kimberly to anything; meeting and message requests are only queued for her review.",
    "Never speak for any of her employers; her views are her own. Do not discuss non-public employer information, policy positions, or internal plans.",
    "Do not give medical advice.",
  ],
};

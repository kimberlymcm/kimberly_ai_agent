// Pulls posts from the Substack RSS feed into src/posts.generated.json.
// Run: npm run sync   (then redeploy)
import { writeFileSync } from "node:fs";

// Posts whose text should NOT go into the agent's knowledge (title + link are still kept so it can point to them).
const LINK_ONLY = ["what-ive-learned-working-in-government"];

const FEED = "https://missiondistrictai.substack.com/feed";
const xml = await (await fetch(FEED)).text();

const decode = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#8217;|&rsquo;/g, "’").replace(/&#39;/g, "'");
const tag = (item, name) => {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]).trim() : "";
};
const htmlToText = (html) =>
  decode(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, "")
    .replace(/<\/(p|h[1-6]|li|blockquote|div)>/g, "\n\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<li[^>]*>/g, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n").trim();

const posts = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  .map(([, item]) => ({
    title: tag(item, "title"),
    url: tag(item, "link"),
    date: new Date(tag(item, "pubDate")).toISOString().slice(0, 10),
    description: tag(item, "description"),
    text: htmlToText(tag(item, "content:encoded")),
  }))
  .filter((p) => p.url && p.text.length > 200) // drops the "Coming soon" stub
  .map((p) => (LINK_ONLY.some((slug) => p.url.includes(slug)) ? { ...p, text: "" } : p));

writeFileSync(new URL("../src/posts.generated.json", import.meta.url), JSON.stringify(posts, null, 1));
console.log(`Wrote ${posts.length} posts, ${posts.reduce((n, p) => n + p.text.length, 0)} chars`);

// Collects 👍/👎 from the site into Netlify Blobs. You read it with ADMIN_CODE:
//   https://YOUR-SITE.netlify.app/api/feedback?code=YOUR_ADMIN_CODE
import { open, getJSON, setJSON } from "../../lib/store.mjs";

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f]/g, " ").slice(0, n);

export default async (req) => {
  const s = open("feedback");
  if (req.method === "GET") {
    const admin = process.env.ADMIN_CODE;
    const code = new URL(req.url).searchParams.get("code") || req.headers.get("x-admin-code");
    if (!admin || code !== admin) return json({ error: "not_found" }, 404);
    if (!s) return json({ items: [], note: "storage unavailable" });
    const { blobs } = await s.list();
    const keys = blobs.map(b => b.key).sort().reverse().slice(0, 100);
    const items = (await Promise.all(keys.map(k => getJSON(s, k)))).filter(Boolean);
    const down = items.filter(i => i.vote === "down").length;
    return json({ total: items.length, up: items.length - down, down, items });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const vote = b.vote === "up" ? "up" : b.vote === "down" ? "down" : null;
  const claim = clean(b.claim, 400);
  if (!vote || !claim) return json({ error: "bad_request" }, 400);
  const ts = Date.now();
  const rec = { ts, when: new Date(ts).toISOString(), claim, verdict: clean(b.verdict, 20), vote, note: clean(b.note, 200) };
  const ok = await setJSON(s, `${String(ts).padStart(14, "0")}-${Math.random().toString(36).slice(2, 7)}`, rec);
  return json({ ok });
};

export const config = {
  path: "/api/feedback",
  rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ["ip", "domain"] }
};

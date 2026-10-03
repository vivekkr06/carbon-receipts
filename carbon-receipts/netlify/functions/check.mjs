// Netlify Function: runs the Carbon Receipts agent loop server-side.
// Your Anthropic API key stays here (env var), never in the browser.
import data from "../../data/co2.json";
import { createCore } from "../../lib/core.mjs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const MAX_ROUNDS = 6;            // step 4: cap the loop
const MAX_CLAIM = 400;           // step 6: input guardrail

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default async (req) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (req.method === "GET") return json({ live: !!key, needsCode: !!process.env.ACCESS_CODE, model: MODEL });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!key) return json({ error: "not_configured" }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const claim = String(body.claim || "").trim();
  if (!claim || claim.length > MAX_CLAIM) return json({ error: "claim_length" }, 400);
  if (process.env.ACCESS_CODE && body.code !== process.env.ACCESS_CODE) return json({ error: "access_code" }, 401);

  const core = createCore(data);
  const state = core.newState();
  const trace = [];
  const ev = (cls, title, text) => trace.push({ cls, title, text });
  const tools = core.TOOLS;
  const messages = [{ role: "user", content: core.instructions(claim, body.lessons) }];
  let summary = "";

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const last = round === MAX_ROUNDS - 1;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, tools, ...(last ? { tool_choice: { type: "none" } } : {}), messages })
      });
      if (!r.ok) { const t = await r.text(); console.error("anthropic", r.status, t); return json({ error: r.status === 429 ? "rate_limited" : "upstream_error" }, 502); }
      const res = await r.json();
      messages.push({ role: "assistant", content: res.content });
      const text = res.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      if (text) summary = text;
      if (res.stop_reason !== "tool_use") break;
      const results = res.content.filter(b => b.type === "tool_use").map(b => {
        try { return { type: "tool_result", tool_use_id: b.id, content: JSON.stringify(core.exec(b.name, b.input, state, ev)) }; }
        catch (e) { return { type: "tool_result", tool_use_id: b.id, content: "Error: " + e.message, is_error: true }; }
      });
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    console.error(e);
    return json({ error: "upstream_error" }, 502);
  }
  const parts = summary.split(/\n\s*\n/);
  return json({ trace, state, summary: parts[parts.length - 1] || state.reason, model: MODEL });
};

export const config = { path: "/api/check" };

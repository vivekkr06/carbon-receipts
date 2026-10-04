// Netlify Function: runs the Carbon Receipts agent loop server-side.
// Your Anthropic API key stays here (env var), never in the browser.
import data from "../../data/co2.json";
import { createCore } from "../../lib/core.mjs";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
const MAX_ROUNDS = 6;                                        // cap the loop
const MAX_CLAIM = 400;                                       // input guardrail
const BUDGET_MS = Number(process.env.FUNCTION_BUDGET_MS) || 22000; // stay under the platform limit

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Turn an Anthropic API failure into a short code the page can explain.
function classify(status, text) {
  if (status === 401 || status === 403) return "server_auth";
  if (status === 404) return "server_model";
  if (status === 429) return "rate_limited";
  if (status === 400 && /credit|billing/i.test(text)) return "server_credits";
  if (status === 529 || status >= 500) return "upstream_busy";
  return "upstream_error";
}

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

  const t0 = Date.now();
  const core = createCore(data);
  const state = core.newState();
  const trace = [];
  const ev = (cls, title, text) => trace.push({ cls, title, text });
  const messages = [{ role: "user", content: core.instructions(claim, body.lessons) }];
  let lastText = "";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const left = BUDGET_MS - (Date.now() - t0);
    if (left < 2500) { console.error("budget exhausted before round", round + 1); return json({ error: "timeout" }, 504); }
    const last = round === MAX_ROUNDS - 1;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), left);
    let res;
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ctl.signal,
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: 800, tools: core.TOOLS, ...(last ? { tool_choice: { type: "none" } } : {}), messages })
      });
      if (!r.ok) {
        const text = await r.text();
        const code = classify(r.status, text);
        console.error(`anthropic ${r.status} -> ${code}:`, text.slice(0, 400));   // visible in Netlify function logs only
        return json({ error: code, status: r.status }, 502);
      }
      res = await r.json();
    } catch (e) {
      console.error("anthropic call failed:", e && e.name, e && e.message);
      return json({ error: e && e.name === "AbortError" ? "timeout" : "upstream_error" }, 504);
    } finally { clearTimeout(timer); }
    console.log(`round ${round + 1}: ${Date.now() - t0} ms elapsed, stop_reason=${res.stop_reason}`);

    messages.push({ role: "assistant", content: res.content });
    const text = res.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    if (text) lastText = text;
    if (res.stop_reason !== "tool_use") break;

    const results = res.content.filter(b => b.type === "tool_use").map(b => {
      try { return { type: "tool_result", tool_use_id: b.id, content: JSON.stringify(core.exec(b.name, b.input, state, ev)) }; }
      catch (e) { return { type: "tool_result", tool_use_id: b.id, content: "Error: " + e.message, is_error: true }; }
    });
    if (state.submissions > 0) break;          // ruling is in: no need for another model call
    messages.push({ role: "user", content: results });
  }
  const parts = lastText.split(/\n\s*\n/);
  console.log(`done in ${Date.now() - t0} ms`);
  return json({ trace, state, summary: state.reason || parts[parts.length - 1] || "", model: MODEL, ms: Date.now() - t0 });
};

export const config = { path: "/api/check" };

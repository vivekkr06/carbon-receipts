// Netlify Function: runs the Carbon Receipts agent loop server-side and streams its steps.
// Your Anthropic API key stays here (env var), never in the browser.
//
// Protection layers, outermost first:
//   1. config.rateLimit            Netlify blocks a visitor sending too many requests per minute (HTTP 429)
//   2. ACCESS_CODE (optional)      only people with the code can run live checks
//   3. DAILY_CHECK_CAP             hard ceiling on model-backed checks per UTC day (default 300)
//   4. saved answers               a claim already answered AND verified is served from storage, no model call
import data from "../../data/co2.json";
import { createCore } from "../../lib/core.mjs";
import { open, getJSON, setJSON, sha256 } from "../../lib/store.mjs";

const MODELS = [...new Set([process.env.ANTHROPIC_MODEL, "claude-haiku-4-5-20251001", "claude-haiku-4-5"].map(m => (m || "").trim()).filter(Boolean))];
const MAX_ROUNDS = 6;
const MAX_CLAIM = 400;
const BUDGET_MS = Number(process.env.FUNCTION_BUDGET_MS) || 22000;
const dailyCap = () => Number(process.env.DAILY_CHECK_CAP) || 300;
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;
const core = createCore(data);
const DATA_VERSION = `${data.entities.length}-${data.years.join("")}-${data.m.co2.World[data.years[1] - data.years[0]]}`;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function classify(status, text) {
  if (status === 401 || status === 403) return "server_auth";
  if (status === 404) return "server_model";
  if (status === 429) return "rate_limited";
  if (status === 400 && /credit|billing/i.test(text)) return "server_credits";
  if (status === 529 || status >= 500) return "upstream_busy";
  return "upstream_error";
}
const normClaim = c => c.toLowerCase().replace(/\s+/g, " ").replace(/[“”"]/g, "").trim();
const today = () => new Date().toISOString().slice(0, 10);

// Runs the agent. emit(obj) is called for each step. Resolves {state, summary, model} or throws {code}.
async function runAgent(claim, key, emit, t0) {
  const state = core.newState();
  const messages = [{ role: "user", content: core.instructions(claim, core.DEFAULT_LESSONS) }];
  const ev = (cls, title, text) => emit({ t: "trace", cls, title, text });
  let lastText = "", mi = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const last = round === MAX_ROUNDS - 1;
    let res;
    for (;;) {
      const left = BUDGET_MS - (Date.now() - t0);
      if (left < 2500) { console.error("budget exhausted before round", round + 1); throw { code: "timeout" }; }
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), left);
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", signal: ctl.signal,
          headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: MODELS[mi], max_tokens: 800, tools: core.TOOLS, ...(last ? { tool_choice: { type: "none" } } : {}), messages })
        });
        if (!r.ok) {
          const text = await r.text(); const code = classify(r.status, text);
          console.error(`anthropic ${r.status} -> ${code} (model "${MODELS[mi]}"):`, text.slice(0, 400));
          if (code === "server_model" && mi < MODELS.length - 1) { mi++; console.error(`falling back to model "${MODELS[mi]}"`); continue; }
          throw { code };
        }
        res = await r.json(); break;
      } catch (e) {
        if (e && e.code) throw e;
        console.error("anthropic call failed:", e && e.name, e && e.message);
        throw { code: e && e.name === "AbortError" ? "timeout" : "upstream_error" };
      } finally { clearTimeout(timer); }
    }
    console.log(`round ${round + 1}: ${Date.now() - t0} ms, model=${MODELS[mi]}, stop_reason=${res.stop_reason}`);
    messages.push({ role: "assistant", content: res.content });
    const text = res.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    if (text) lastText = text;
    if (res.stop_reason !== "tool_use") break;
    emit({ t: "status", text: round === 0 ? "Looking up the numbers…" : "Writing the ruling…" });
    const results = res.content.filter(b => b.type === "tool_use").map(b => {
      try { return { type: "tool_result", tool_use_id: b.id, content: JSON.stringify(core.exec(b.name, b.input, state, ev)) }; }
      catch (e) { return { type: "tool_result", tool_use_id: b.id, content: "Error: " + e.message, is_error: true }; }
    });
    if (state.submissions > 0) break;
    messages.push({ role: "user", content: results });
  }
  const parts = lastText.split(/\n\s*\n/);
  return { state, summary: state.reason || parts[parts.length - 1] || "", model: MODELS[mi] };
}

export default async (req) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (req.method === "GET") return json({ live: !!apiKey, needsCode: !!process.env.ACCESS_CODE, model: MODELS[0], fallbacks: MODELS.slice(1), dailyCap: dailyCap() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!apiKey) return json({ error: "not_configured" }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const claim = String(body.claim || "").trim();
  if (!claim || claim.length > MAX_CLAIM) return json({ error: "claim_length" }, 400);
  if (process.env.ACCESS_CODE && body.code !== process.env.ACCESS_CODE) return json({ error: "access_code" }, 401);

  // Saved answers: only ever contains rulings whose every number was verified.
  const answers = open("answers");
  const cacheKey = await sha256(`${core.PROMPT_VERSION}|${DATA_VERSION}|${normClaim(claim)}`);
  const hit = await getJSON(answers, cacheKey);
  if (hit && hit.ts && Date.now() - hit.ts < CACHE_TTL_MS && hit.state && hit.state.verdict) {
    console.log("cache hit", cacheKey.slice(0, 10));
    return json({ trace: hit.trace, state: hit.state, summary: hit.summary, model: hit.model, cached: true, ms: 0 });
  }

  // Daily cap on model-backed checks (approximate: counter is read then written).
  const caps = open("caps"), capKey = "day-" + today();
  const used = (await getJSON(caps, capKey))?.n || 0;
  if (used >= dailyCap()) return json({ error: "daily_cap" }, 429);
  await setJSON(caps, capKey, { n: used + 1 });

  const t0 = Date.now();
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = obj => { try { controller.enqueue(enc.encode(JSON.stringify(obj) + "\n")); } catch {} };
      try {
        emit({ t: "status", text: "Reading the data…" });
        const trace = [];
        const out = await runAgent(claim, apiKey, o => { if (o.t === "trace") trace.push({ cls: o.cls, title: o.title, text: o.text }); emit(o); }, t0);
        const vr = core.verify(out.state, null);
        const ms = Date.now() - t0;
        console.log(`done in ${ms} ms, verdict=${out.state.verdict}, verified=${vr.pass}`);
        if (vr.pass && out.state.verdict) await setJSON(answers, cacheKey, { ts: Date.now(), claim: normClaim(claim), trace, state: out.state, summary: out.summary, model: out.model });
        emit({ t: "result", state: out.state, summary: out.summary, model: out.model, ms });
      } catch (e) {
        emit({ t: "error", code: (e && e.code) || "upstream_error" });
      } finally { try { controller.close(); } catch {} }
    }
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store", "x-accel-buffering": "no" } });
};

export const config = {
  path: "/api/check",
  rateLimit: { windowLimit: 15, windowSize: 60, aggregateBy: ["ip", "domain"] }
};

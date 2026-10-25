import { createCore } from "./lib/core.mjs";
const CONFIG = { LINKEDIN_URL: "https://www.linkedin.com/in/kumarvivek06/", API: "/api/check", FEEDBACK: "/api/feedback" };
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
let D, GEO;
try {
  [D, GEO] = await Promise.all(["data/co2.json", "data/geo.json"].map(u => fetch(u).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); })));
} catch (e) {
  console.error("Could not load data:", e);
  document.querySelector("#result").innerHTML = `<div class="result"><div class="big" style="font-size:26px">The data didn't load</div><p class="sum">${location.protocol === "file:" ? "Open this page through a web server (or the deployed site) rather than from a file, because it loads its data files." : "Refresh the page. If it keeps happening, the data files may be missing."}</p></div>`;
  throw e;
}
const core = createCore(D);
const { Y0, Y1, METRICS, ent, val, r1, LABEL, short } = core;
const COUNTRIES = Object.keys(D.iso);
$("#liLink").href = CONFIG.LINKEDIN_URL;
const NC = COUNTRIES.length;
document.querySelectorAll("[data-nc]").forEach(el => el.textContent = NC);
const COLORS = {"China":"var(--coral)","United States":"var(--sky)","European Union (27)":"var(--lav)","India":"var(--sun)","Russia":"#8C6A4F","Japan":"#D96BA8","United Kingdom":"#3BA3B8","Netherlands":"#F08A3C","World":"var(--ink)","Saudi Arabia":"#6E9E3C","Australia":"#C9A227","Germany":"#5B7BA6","Nigeria":"#A0522D"};
const PALETTE = ["var(--teal)","#E0457B","#7A5C3E","#6E9E3C","#B45FD6","#2F7F8F","#E8743B","#C9A227","#8A8FA3","#3F9B5B"];
const assigned = {};
const colorOf = (e) => COLORS[e] || assigned[e] || (assigned[e] = PALETTE[Object.keys(assigned).length % PALETTE.length]);
$("#placeList").innerHTML = D.entities.map(e => `<option value="${esc(e)}">`).join("");

// ---------- Golden set (answer key computed from data) ----------
const v = val;
const rankOf = (e, m, y) => COUNTRIES.filter(c => v(c, m, y) != null).sort((a,b) => v(b,m,y) - v(a,m,y)).indexOf(e) + 1;
const pc = (e,a,b,m="co2") => (v(e,m,b)/v(e,m,a)-1)*100;
const G = [
  {id:"G1",text:"China emitted more CO₂ in 2024 than the United States and the EU combined.",figs:[["China","co2",2024],["United States","co2",2024],["European Union (27)","co2",2024]],truth:()=>v("China","co2",2024)>v("United States","co2",2024)+v("European Union (27)","co2",2024)},
  {id:"G2",text:"The average American emits more CO₂ than the average person in China.",figs:[["United States","co2_per_capita",2024],["China","co2_per_capita",2024]],truth:()=>v("United States","co2_per_capita",2024)>v("China","co2_per_capita",2024)},
  {id:"G3",text:"India's emissions per person are above the world average.",figs:[["India","co2_per_capita",2024],["World","co2_per_capita",2024]],truth:()=>v("India","co2_per_capita",2024)>v("World","co2_per_capita",2024)},
  {id:"G4",text:"The UK has roughly halved its CO₂ emissions since 1990.",figs:[["United Kingdom","co2",1990],["United Kingdom","co2",2024]],truth:()=>{const p=pc("United Kingdom",1990,2024);return p<=-40&&p>=-60}},
  {id:"G5",text:"Germany emits more CO₂ today than it did in 1990.",figs:[["Germany","co2",1990],["Germany","co2",2024]],truth:()=>v("Germany","co2",2024)>v("Germany","co2",1990)},
  {id:"G6",text:"The EU is responsible for more than 10% of the world's CO₂ emissions.",figs:[["European Union (27)","share_global_co2",2024]],truth:()=>v("European Union (27)","share_global_co2",2024)>10},
  {id:"G7",text:"Coal accounts for more than half of India's CO₂ emissions.",figs:[["India","coal_co2",2024],["India","co2",2024]],truth:()=>v("India","coal_co2",2024)>0.5*v("India","co2",2024)},
  {id:"G8",text:"Saudi Arabia emits more CO₂ per person than Australia.",figs:[["Saudi Arabia","co2_per_capita",2024],["Australia","co2_per_capita",2024]],truth:()=>v("Saudi Arabia","co2_per_capita",2024)>v("Australia","co2_per_capita",2024)},
  {id:"G9",text:"Global CO₂ emissions have fallen since 2019.",figs:[["World","co2",2019],["World","co2",2024]],truth:()=>v("World","co2",2024)<v("World","co2",2019)},
  {id:"G10",text:"The Netherlands' emissions grew between 1990 and 2024.",figs:[["Netherlands","co2",1990],["Netherlands","co2",2024]],truth:()=>v("Netherlands","co2",2024)>v("Netherlands","co2",1990)},
  {id:"G11",text:"Historically, the United States has emitted more CO₂ than China.",figs:[["United States","cumulative_co2",2024],["China","cumulative_co2",2024]],truth:()=>v("United States","cumulative_co2",2024)>v("China","cumulative_co2",2024)},
  {id:"G12",text:"Counting imported goods, the UK's carbon footprint in 2023 was bigger than the emissions produced inside the country.",figs:[["United Kingdom","consumption_co2",2023],["United Kingdom","co2",2023]],truth:()=>v("United Kingdom","consumption_co2",2023)>v("United Kingdom","co2",2023)},
  {id:"G13",text:"Nigeria's methane emissions have doubled since 2000.",figs:[],truth:()=>null},
  {id:"G14",text:"Global CO₂ emissions fell in 2025.",figs:[],truth:()=>null},
  {id:"G15",text:"India is the third-largest CO₂ emitter in the world.",figs:[["India","co2",2024]],truth:()=>rankOf("India","co2",2024)===3},
  {id:"G16",text:"Nigeria emits less CO₂ per person than the world average.",figs:[["Nigeria","co2_per_capita",2024],["World","co2_per_capita",2024]],truth:()=>v("Nigeria","co2_per_capita",2024)<v("World","co2_per_capita",2024)},
  {id:"G17",text:"Brazil emits more CO₂ per person than India.",figs:[["Brazil","co2_per_capita",2024],["India","co2_per_capita",2024]],truth:()=>v("Brazil","co2_per_capita",2024)>v("India","co2_per_capita",2024)},
  {id:"G18",text:"Iran emitted more CO₂ than Germany in 2024.",figs:[["Iran","co2",2024],["Germany","co2",2024]],truth:()=>v("Iran","co2",2024)>v("Germany","co2",2024)},
  {id:"G19",text:"Qatar has the highest CO₂ emissions per person of any country.",figs:[["Qatar","co2_per_capita",2024]],truth:()=>rankOf("Qatar","co2_per_capita",2024)===1},
  {id:"G20",text:"Malta's CO₂ emissions have fallen since 1990.",figs:[["Malta","co2",1990],["Malta","co2",2024]],truth:()=>v("Malta","co2",2024)<v("Malta","co2",1990)},
  {id:"G21",text:"Ivory Coast emitted more CO₂ in 2024 than in 1990.",figs:[["Cote d'Ivoire","co2",1990],["Cote d'Ivoire","co2",2024]],truth:()=>v("Cote d'Ivoire","co2",2024)>v("Cote d'Ivoire","co2",1990)},
  {id:"G22",text:"The Democratic Republic of Congo emits more CO₂ than the Republic of the Congo.",figs:[["Democratic Republic of Congo","co2",2024],["Congo","co2",2024]],truth:()=>v("Democratic Republic of Congo","co2",2024)>v("Congo","co2",2024)},
  {id:"G23",text:"Algeria's carbon footprint including imports in 2023 was bigger than its territorial emissions.",figs:[],truth:()=>(v("Algeria","consumption_co2",2023)==null?null:v("Algeria","consumption_co2",2023)>v("Algeria","co2",2023))},
  {id:"G24",text:"Luxembourg's CO₂ emissions per person fell between 1990 and 2024.",figs:[["Luxembourg","co2_per_capita",1990],["Luxembourg","co2_per_capita",2024]],truth:()=>v("Luxembourg","co2_per_capita",2024)<v("Luxembourg","co2_per_capita",1990)},
  {id:"G25",text:"EU emissions have fallen by more than 30% since 1990.",figs:[["European Union (27)","co2",1990],["European Union (27)","co2",2024]],truth:()=>pc("European Union (27)",1990,2024)<-30},
  {id:"G26",text:"Africa emits more CO₂ than the EU.",figs:[["Africa","co2",2024],["European Union (27)","co2",2024]],truth:()=>v("Africa","co2",2024)>v("European Union (27)","co2",2024)},
  {id:"G27",text:"Asia accounts for more than half of global CO₂ emissions.",figs:[["Asia","share_global_co2",2024]],truth:()=>v("Asia","share_global_co2",2024)>50}
];
G.forEach(g => { const t = g.truth(); g.expected = t === null ? "NOT_IN_DATA" : (t ? "SUPPORTED" : "REFUTED"); });
const PASS_AT = Math.ceil(G.length * 0.92);
const byText = t => G.find(g => g.text.toLowerCase() === String(t).trim().toLowerCase());

// ---------- Storage ----------
const store = { get(k,f){try{const x=localStorage.getItem(k);return x==null?f:JSON.parse(x)}catch{return f}}, set(k,x){try{localStorage.setItem(k,JSON.stringify(x))}catch{}} };
const DEFAULT_LESSONS = core.DEFAULT_LESSONS;
const lessonsEl = { value: DEFAULT_LESSONS };  // used only in-Claude; the server uses its own copy
function renderLog(){ if (!$("#log")) return; const log = store.get("cc.log", []); $("#log").innerHTML = log.length ? log.slice().reverse().map(r => `<li><span class="tag ${r.verdict||"none"}">${LABEL[r.verdict]||"No ruling"}</span> ${esc(r.claim.slice(0,70))}${r.claim.length>70?"…":""}<br><span style="color:var(--ink-2);font-size:13px">${esc(r.when)} · ${r.mode} · checks ${r.pass?"passed":"failed"}</span></li>`).join("") : `<li style="color:var(--ink-2)">No runs yet. Check a claim to start the log.</li>`; }
function logRun(r){ const log = store.get("cc.log", []); log.push(r); store.set("cc.log", log.slice(-20)); renderLog(); }
renderLog();

// ---------- Modes ----------
let MODE = "replay", sample = null, needsCode = false, busy = false;
function setMode(m, extra){
  MODE = m;
  const pill = $("#modePill");
  pill.classList.toggle("live", m !== "replay");
  $("#modeTxt").textContent = m === "claude" ? "Live in Claude" : m === "server" ? "Live" : "Demo mode";
  $("#modeNote").textContent = m === "replay" ? "Demo mode: the examples replay how the agent works. Live checking of your own claims switches on when the site has its API key." : "";
  $("#codeRow").style.display = (m === "server" && needsCode) ? "flex" : "none";
  $("#tier").hidden = m !== "claude";
  $("#score").hidden = m !== "claude";
  $("#evalBtn").disabled = m === "replay";
  $("#evalStatus").textContent = m === "replay" ? "Scoring runs the live agent, so it needs live mode." : "";
}
setMode("replay");
(async () => {
  try {
    if (window.claude && window.claude.use) {
      const s = await window.claude.use("sample");
      if (s) { const lim = await s.limits().catch(() => null); if (lim && lim.tools) { sample = s; setMode("claude"); return; } }
    }
  } catch {}
  try {
    const r = await fetch(CONFIG.API, { method: "GET" });
    if (r.ok) { const j = await r.json(); if (j.live) { needsCode = !!j.needsCode; setMode("server"); } }
  } catch {}
})();

// ---------- Agent runs ----------
function toolsForSample(state, ev){
  return core.TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.input_schema, execute: i => core.exec(t.name, i, state, ev) }));
}
async function agentClaude(claim, ev, signal, tier){
  const state = core.newState();
  const res = await sample(core.instructions(claim, lessonsEl.value), { tools: toolsForSample(state, ev), signal, modelTier: tier || "default" });
  const parts = res.text.trim().split(/\n\s*\n/);
  return { state, summary: parts[parts.length-1] };
}
let streamed = false;
const setThink = t => { streamed = true; const el = $("#thinkTxt"); if (el) el.textContent = t; };
async function agentServer(claim, ev){
  let r;
  try { r = await fetch(CONFIG.API, { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ claim, code: $("#code").value }) }); }
  catch { throw { code: "network" }; }
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("ndjson")) {
    const j = await r.json().catch(() => null);
    if (!j) throw { code: r.status === 429 ? "rate_limited" : (r.status === 504 || r.status === 502) ? "platform_timeout" : "platform_error", status: r.status };
    if (!r.ok || j.error) throw { code: j.error || "upstream_error", status: r.status, upstream: j.status };
    for (const t of j.trace || []) { await wait(110); ev(t.cls, t.title, t.text); }
    return { state: j.state, summary: j.summary, cached: !!j.cached };
  }
  const reader = r.body.getReader(), dec = new TextDecoder(); let buf = "", result = null;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.t === "status") setThink(m.text); else if (m.t === "trace") ev(m.cls, m.title, m.text); else if (m.t === "result") result = m; else if (m.t === "error") throw { code: m.code };
    }
  }
  if (!result) throw { code: "platform_timeout" };
  return { state: result.state, summary: result.summary, cached: false };
}
async function agentReplay(g, ev){
  const state = core.newState();
  await wait(400); core.exec("list_coverage", {}, state, ev);
  const groups = {}; g.figs.forEach(([e,m,y]) => { (groups[e+"|"+m] = groups[e+"|"+m] || { e, m, ys: [] }).ys.push(y); });
  for (const k in groups) { await wait(420); core.exec("get_values", { entity: groups[k].e, metric: groups[k].m, years: groups[k].ys }, state, ev); }
  if (!g.figs.length) { await wait(420); ev("err", "coverage", "this claim needs data outside the snapshot"); }
  await wait(420);
  const figs = g.figs.map(([e,m,y]) => ({ entity:e, metric:m, year:y, value: val(e,m,y) }));
  core.exec("submit_verdict", { verdict: g.expected, reason: "", figures: figs }, state, ev);
  const summary = g.expected === "NOT_IN_DATA" ? `The snapshot covers fossil CO₂ from ${Y0} to ${Y1}, so it can't rule on this one. Rather than guess, the agent says so.` :
    "The numbers: " + figs.map(f => `${short(ent(f.entity))} ${METRICS[f.metric].label}, ${f.year}: ${r1(f.value)} ${METRICS[f.metric].unit}`).join("; ") + ".";
  return { state, summary };
}
const ERR = { not_granted:"Live runs aren't allowed in this view.", tools_unavailable:"This view can't run the agent's tools.", rate_limited:"Too many checks right now. Try again in a minute.", daily_cap:"Today's free checks have run out. Please come back tomorrow.", access_code:"That access code didn't work.", claim_length:"Keep the claim under 400 characters.", not_configured:"Live checking isn't switched on for this site.", session_expired:"Sign in to Claude again to run live.", refused:"The agent declined this one. Try rewording it.", timeout:"That took too long. Try again, or try a simpler claim.", platform_timeout:"The server didn't answer in time. Try again.", platform_error:"The server returned an unexpected response. Try again.", network:"Couldn't reach the server. Check your connection and try again.", upstream_busy:"The AI service is busy right now. Try again in a moment.", upstream_error:"The AI service returned an error. Try again in a moment.", server_auth:"Live checking is temporarily unavailable.", server_credits:"Live checking is temporarily unavailable.", server_model:"Live checking is temporarily unavailable." };

// ---------- Result rendering ----------
const resultEl = $("#result");
function skeleton(claim){
  resultEl.innerHTML = `<div class="result"><div class="result-top"><div class="result-left"><p class="claimtxt"></p><div class="thinking"><span class="spinner"></span><span id="thinkTxt">Reading the data…</span></div></div><div class="result-right"><p class="viz-title">Evidence</p><p style="color:var(--ink-2);font-size:15px">The numbers appear here once the agent has found them.</p></div></div><details class="work" open><summary>How the agent worked it out</summary><div class="trace" id="trace"></div></details></div>`;
  resultEl.querySelector(".claimtxt").textContent = "“" + claim + "”";
  resultEl.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  const msgs = ["Reading the data…","Looking up the numbers…","Doing the arithmetic…","Writing the ruling…"]; let i = 0;
  streamed = false;
  const t = setInterval(() => { const el = $("#thinkTxt"); if (!el) return clearInterval(t); if (streamed) return; i = (i+1) % msgs.length; el.textContent = msgs[i]; }, 2200);
  return () => clearInterval(t);
}
function ev(cls, title, text){
  const tr = $("#trace"); if (!tr) return;
  const d = document.createElement("div"); d.className = "ev " + cls;
  d.innerHTML = `<span class="ic">${cls==="read"?"↓":cls==="act"?"✓":"!"}</span><span><b></b> <span></span></span>`;
  d.querySelector("b").textContent = title; d.querySelector("span span").textContent = text;
  tr.append(d);
}
function vizFor(state){
  const figs = state.figures;
  if (!figs.length) {
    return `<p class="viz-title">Outside the data</p><p style="font-size:15px">This snapshot only covers these measures, ${Y0}–${Y1}:</p><div class="outside">${Object.values(METRICS).map(m=>`<span>${esc(m.label)}</span>`).join("")}</div>`;
  }
  const ents = [...new Set(figs.map(f => ent(f.entity) || f.entity))], mets = [...new Set(figs.map(f => f.metric))], yrs = [...new Set(figs.map(f => f.year))];
  if (ents.length === 1 && mets.length === 1 && yrs.length >= 2 && ent(ents[0]) && METRICS[mets[0]]) {
    const E = ents[0], m = mets[0]; const W = 520, H = 230, L = 46, R = 14, T = 16, B = 28;
    const pts = []; for (let y = Y0; y <= Y1; y++) { const x = val(E,m,y); if (x != null) pts.push([y,x]); }
    const max = nice(Math.max(...pts.map(p=>p[1])) * 1.08), min = 0;
    const X = y => L + (y - Y0) / (Y1 - Y0) * (W - L - R), Yp = x => T + (1 - (x - min) / (max - min)) * (H - T - B);
    const d = pts.map((p,i) => (i?"L":"M") + X(p[0]).toFixed(1) + " " + Yp(p[1]).toFixed(1)).join(" ");
    const col = E === "World" ? "var(--sky)" : colorOf(E, 0);
    const fs = figs.slice().sort((a,b)=>a.year-b.year);
    const marks = fs.map((f,k) => { const t = val(E,m,f.year); if (t==null) return ""; const x = X(f.year), y = Yp(t);
      const anc = x > W*0.75 ? "end" : x < W*0.25 ? "start" : "middle";
      const crowded = k < fs.length-1 && X(fs[k+1].year) - x < 110;
      const ty = crowded ? y + 24 : y - 12;
      return `<circle cx="${x}" cy="${y}" r="6" fill="${col}" stroke="var(--card)" stroke-width="2.5"/><text x="${x + (anc==="end"?6:0)}" y="${ty}" text-anchor="${anc}" font-size="12.5" font-weight="700" fill="var(--ink)" paint-order="stroke" stroke="var(--tint)" stroke-width="4">${f.year}: ${r1(t)}</text>`; }).join("");
    const ticks = [0, max/2, max].map(t => `<text x="${L-8}" y="${Yp(t)+4}" text-anchor="end" font-size="11" fill="var(--ink-2)">${r1(Math.round(t))}</text><line x1="${L}" x2="${W-R}" y1="${Yp(t)}" y2="${Yp(t)}" stroke="var(--rule)"/>`).join("");
    return `<p class="viz-title">${esc(short(E))} · ${esc(METRICS[m].label)} (${esc(METRICS[m].unit)}), ${Y0}–${Y1}</p><div class="viz"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart of ${esc(E)} ${esc(METRICS[m].label)}">${ticks}<path d="${d} L${X(pts[pts.length-1][0])} ${Yp(0)} L${X(pts[0][0])} ${Yp(0)} Z" fill="${col}" opacity=".12"/><path d="${d}" fill="none" stroke="${col}" stroke-width="3" stroke-linejoin="round"/>${marks}<text x="${L}" y="${H-6}" font-size="11" fill="var(--ink-2)">${Y0}</text><text x="${W-R}" y="${H-6}" text-anchor="end" font-size="11" fill="var(--ink-2)">${Y1}</text></svg></div>`;
  }
  const groups = {}; figs.forEach(f => { const u = METRICS[f.metric] ? METRICS[f.metric].unit : "?"; (groups[u] = groups[u] || []).push(f); });
  let html = `<p class="viz-title">The numbers it used</p><div class="viz">`;
  for (const u in groups) {
    const gmax = Math.max(...groups[u].map(f => Math.abs(f.truth ?? f.value) || 0)) || 1;
    if (Object.keys(groups).length > 1) html += `<p class="unitlbl">${esc(u)}</p>`;
    groups[u].forEach((f,i) => {
      const E = ent(f.entity) || f.entity, x = f.truth ?? f.value, w = Math.max(2, Math.abs(x) / gmax * 100);
      html += `<div class="barrow"><span>${esc(short(E))} <span style="color:var(--ink-2)">${esc(METRICS[f.metric]?METRICS[f.metric].label:f.metric)}, ${f.year}</span></span><span class="track"><span class="fill" style="display:block;width:${w}%;background:${colorOf(E,i)};animation-delay:${i*90}ms"></span></span><span class="num ${f.ok?"":"bad"}">${r1(f.value)}${f.ok?"":` <span style="font-weight:500">(data: ${r1(f.truth)})</span>`}</span></div>`;
    });
    if (Object.keys(groups).length === 1) html += `<p class="unitlbl">${esc(u)}</p>`;
  }
  return html + `</div>`;
}
function renderResult(claim, state, summary, vr){
  const left = resultEl.querySelector(".result-left"), right = resultEl.querySelector(".result-right");
  const vd = state.verdict || "";
  left.innerHTML = `<p class="claimtxt"></p><div class="big v-${vd}">${LABEL[vd] || "No ruling"}</div><p class="sum"></p><ul class="checks">${vr.checks.map(c => `<li><span class="mk ${c.ok?"ok":"no"}">${c.ok?"✓":"✕"}</span><span></span></li>`).join("")}</ul>`;
  left.querySelector(".claimtxt").textContent = "“" + claim + "”";
  left.querySelector(".sum").textContent = summary || state.reason || "";
  left.querySelectorAll(".checks li").forEach((li,i) => li.lastChild.textContent = vr.checks[i].label);
  right.innerHTML = vizFor(state);
  const det = resultEl.querySelector("details.work"); det.open = false;
  det.querySelector("summary").firstChild.textContent = `How the agent worked it out (${$("#trace").children.length} steps)`;
}
function renderError(claim, msg){
  const left = resultEl.querySelector(".result-left");
  left.innerHTML = `<p class="claimtxt"></p><div class="big" style="font-size:28px">Couldn't check that one</div><p class="sum"></p>`;
  left.querySelector(".claimtxt").textContent = "“" + claim + "”"; left.querySelector(".sum").textContent = msg;
}

function addFeedback(claim, out){
  const left = resultEl.querySelector(".result-left"); if (!left) return;
  const box = document.createElement("div"); box.className = "fb";
  box.innerHTML = `${out.cached ? `<span class="saved">Saved answer, re-checked against the data just now</span>` : ""}<span class="q">Was this ruling right?</span><button type="button" data-v="up" aria-label="Yes, it was right">👍</button><button type="button" data-v="down" aria-label="No, it was wrong">👎</button><span class="thx" aria-live="polite"></span>`;
  left.append(box);
  const send = async (vote, note) => {
    box.querySelectorAll("button").forEach(b => b.disabled = true);
    box.querySelector(".thx").textContent = "Thanks, that helps.";
    try { await fetch(CONFIG.FEEDBACK, { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ claim, verdict: out.state.verdict, vote, note }) }); } catch {}
  };
  box.querySelector('[data-v="up"]').onclick = () => send("up", "");
  box.querySelector('[data-v="down"]').onclick = () => {
    box.querySelectorAll("button").forEach(b => b.hidden = true); box.querySelector(".q").hidden = true;
    const f = document.createElement("form"); f.innerHTML = `<input maxlength="200" placeholder="What was wrong? (optional)" aria-label="What was wrong"><button class="btn soft" type="submit">Send</button>`;
    box.insertBefore(f, box.querySelector(".thx")); f.querySelector("input").focus();
    f.onsubmit = e => { e.preventDefault(); const n = f.querySelector("input").value; f.remove(); send("down", n); };
  };
}
async function check(claim, opts = {}){
  claim = String(claim || "").trim(); if (!claim || busy) return;
  const g = byText(claim);
  if (MODE === "replay" && !g) {
    $("#modeNote").textContent = "Live checking isn't switched on here yet, so only the example claims can be replayed. Pick one below.";
    $("#modeNote").style.color = "var(--coral)"; return;
  }
  busy = true; $("#goBtn").disabled = true; $("#claim").value = claim;
  const stop = skeleton(claim);
  try {
    const out = MODE === "claude" ? await agentClaude(claim, ev) : MODE === "server" ? await agentServer(claim, ev) : await agentReplay(g, ev);
    stop();
    const vr = core.verify(out.state, g ? g.expected : null);
    renderResult(claim, out.state, out.summary, vr);
    if (opts.openTrace) resultEl.querySelector("details.work").open = true;
    if (MODE === "server") addFeedback(claim, out);
    logRun({ claim, when: new Date().toLocaleString(), mode: MODE === "replay" ? "demo" : "live", verdict: out.state.verdict, pass: vr.pass });
  } catch (e) {
    stop(); const c = e && e.code; console.error("Check failed:", e);
    renderError(claim, (ERR[c] || "The check was interrupted. Try again.") + (c ? ` (${c})` : ""));
    if (["not_granted","tools_unavailable","sampling_disabled","capability_disabled"].includes(c)) { sample = null; setMode("replay"); }
  } finally { busy = false; $("#goBtn").disabled = false; }
}
$("#askForm").addEventListener("submit", e => { e.preventDefault(); check($("#claim").value); });
$("#claim").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); check($("#claim").value); } });

// Example chips
["G4","G2","G9","G11","G14"].forEach(id => { const g = G.find(x => x.id === id); const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = g.text; b.onclick = () => check(g.text); $("#chips").append(b); });

// ---------- Hero sample card ----------
(function(){
  const g = G.find(x => x.id === "G9"); const W = 380, H = 110;
  const pts = []; for (let y = Y0; y <= Y1; y++) pts.push([y, val("World","co2",y)]);
  const mx = Math.max(...pts.map(p=>p[1])), mn = Math.min(...pts.map(p=>p[1]));
  const X = y => 6 + (y-Y0)/(Y1-Y0)*(W-12), Yp = x => 10 + (1-(x-mn)/(mx-mn))*(H-20);
  const d = pts.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Yp(p[1]).toFixed(1)).join(" ");
  const a = val("World","co2",2019), b = val("World","co2",2024);
  $("#sampleCard").innerHTML = `<span class="stamp v-${g.expected}">${LABEL[g.expected]}</span><p class="lbl">Claim we checked</p><q>${esc(g.text)}</q>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;margin-top:16px" role="img" aria-label="World CO₂ 1990 to 2024"><path d="${d}" fill="none" stroke="var(--coral)" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="${X(2019)}" cy="${Yp(a)}" r="5" fill="var(--ink)"/><circle cx="${X(2024)}" cy="${Yp(b)}" r="5" fill="var(--coral)"/></svg>
    <p style="font-size:15px;margin-top:8px">World CO₂ was <b>${r1(a)} Mt</b> in 2019 and <b>${r1(b)} Mt</b> in 2024, so the claim doesn't hold.</p>
    <button class="btn soft" style="margin-top:14px" id="cardRun">Watch the agent check it</button>`;
  $("#cardRun").onclick = () => check(g.text, { openTrace: true });
})();

// ---------- Data infographic ----------
const MEAS = [["co2","Total"],["co2_per_capita","Per person"],["share_global_co2","Share of world"]];
const DEFAULT_PLACES = ["China","United States","European Union (27)","India","Russia","Japan","United Kingdom","Netherlands","World"];
const MAX_SHOWN = 8;
let PLACES = DEFAULT_PLACES.slice();
let measure = "co2", shown = new Set(["China","United States","European Union (27)","India"]);
MEAS.forEach(([k,l]) => { const b = document.createElement("button"); b.textContent = l; b.setAttribute("aria-pressed", String(k===measure)); b.onclick = () => { measure = k; document.querySelectorAll("#seg button").forEach(x => x.setAttribute("aria-pressed", String(x===b))); drawChart(); }; $("#seg").append(b); });
const chipFor = p => $(`#ctry button[data-p="${CSS.escape(p)}"]`);
function setShown(p, on){ if (on) { shown.add(p); while (shown.size > MAX_SHOWN) { const first = shown.values().next().value; shown.delete(first); const c = chipFor(first); if (c) { c.setAttribute("aria-pressed","false"); if (!DEFAULT_PLACES.includes(first)) { c.remove(); PLACES = PLACES.filter(x => x !== first); } } } } else shown.delete(p); const c = chipFor(p); if (c) c.setAttribute("aria-pressed", String(shown.has(p))); }
function addChip(p){ const i = PLACES.indexOf(p); const b = document.createElement("button"); b.dataset.p = p; b.innerHTML = `<span class="sw" style="background:${colorOf(p,i)}"></span>${esc(short(p))}`; b.setAttribute("aria-pressed", String(shown.has(p))); b.onclick = () => { if (shown.has(p) && shown.size > 1) setShown(p, false); else setShown(p, true); drawChart(); }; $("#ctry").append(b); }
PLACES.forEach(addChip);
function addToChart(p, scroll = true){ if (!PLACES.includes(p)) { PLACES.push(p); addChip(p); } setShown(p, true); drawChart(); if (scroll) document.querySelector(".chartcard").scrollIntoView({behavior:reduce?"auto":"smooth",block:"center"}); }
$("#placeIn").addEventListener("change", e => { const r = core.resolve(e.target.value); if (r.name) { addToChart(r.name, false); e.target.value = ""; } });
function nice(mx){ const p = Math.pow(10, Math.floor(Math.log10(mx))); const n = mx/p; return ([1,1.2,1.5,2,2.5,3,4,5,6,8,10].find(s=>n<=s))*p; }
function lastVal(arr){ for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]; return null; }
function drawChart(){
  const W = 1000, H = 430, L = 64, R = 92, T = 20, B = 36;
  const list = PLACES.filter(p => shown.has(p) && !(measure==="share_global_co2" && p==="World"));
  const mx = nice(Math.max(...list.flatMap(p => D.m[measure][p].filter(x=>x!=null))) * 1.05 || 1);
  const X = y => L + (y-Y0)/(Y1-Y0)*(W-L-R), Yp = x => T + (1 - x/mx)*(H-T-B);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart of ${MEAS.find(m=>m[0]===measure)[1]} CO₂ by place, ${Y0} to ${Y1}">`;
  for (let i = 0; i <= 4; i++) { const t = mx*i/4; s += `<line x1="${L}" x2="${W-R}" y1="${Yp(t)}" y2="${Yp(t)}" stroke="var(--rule)"/><text x="${L-10}" y="${Yp(t)+4}" text-anchor="end" font-size="13" fill="var(--ink-2)">${r1(t)}</text>`; }
  for (let y = 1990; y <= Y1; y += 5) s += `<text x="${X(y)}" y="${H-10}" text-anchor="middle" font-size="13" fill="var(--ink-2)">${y}</text>`;
  s += `<text x="${L}" y="${T-6}" font-size="12.5" fill="var(--ink-2)">${esc(METRICS[measure].unit)}</text>`;
  const ends = [];
  list.forEach(p => {
    const i = PLACES.indexOf(p), arr = D.m[measure][p]; let d = "";
    arr.forEach((x,k) => { if (x==null) return; d += (d?"L":"M") + X(Y0+k).toFixed(1) + " " + Yp(x).toFixed(1); });
    if (!d) return;
    s += `<path d="${d}" fill="none" stroke="${colorOf(p,i)}" stroke-width="${p==="World"?2.5:3.2}" ${p==="World"?'stroke-dasharray="6 5"':""} stroke-linejoin="round" stroke-linecap="round" class="ln"/>`;
    ends.push({ p, y: Yp(lastVal(arr)), c: colorOf(p,i) });
  });
  ends.sort((a,b)=>a.y-b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i-1].y < 16) ends[i].y = ends[i-1].y + 16;
  ends.forEach(e => s += `<text x="${W-R+8}" y="${e.y+4}" font-size="13.5" font-weight="700" fill="${e.c}">${esc(short(e.p).slice(0,14))}</text>`);
  if (measure==="co2" && shown.has("China") && shown.has("United States")) {
    let yr = null; for (let y = Y0; y <= Y1; y++) if (val("China","co2",y) > val("United States","co2",y)) { yr = y; break; }
    if (yr) { const yy = Yp(val("China","co2",yr)); s += `<line x1="${X(yr)}" x2="${X(yr)}" y1="${yy-8}" y2="${yy-58}" stroke="var(--ink)" stroke-width="1.2"/><circle cx="${X(yr)}" cy="${yy}" r="5" fill="none" stroke="var(--ink)" stroke-width="1.6"/><text x="${X(yr)-6}" y="${yy-64}" text-anchor="end" font-size="13.5" font-weight="600" fill="var(--ink)">${yr}: China passes the US</text>`; }
  }
  s += `<line id="cross" x1="0" x2="0" y1="${T}" y2="${H-B}" stroke="var(--ink-2)" stroke-dasharray="3 4" opacity="0"/><rect id="hit" x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="transparent"/></svg>`;
  const host = $("#chart"); host.querySelector("svg")?.remove(); host.insertAdjacentHTML("afterbegin", s);
  const svg = host.querySelector("svg"), tip = $("#tip"), cross = svg.querySelector("#cross");
  const move = e => {
    const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * W;
    const y = Math.round(Y0 + (sx - L) / (W-L-R) * (Y1-Y0)); if (y < Y0 || y > Y1) return;
    cross.setAttribute("x1", X(y)); cross.setAttribute("x2", X(y)); cross.setAttribute("opacity", "1");
    const rows = list.map(p => [p, val(p,measure,y)]).filter(x=>x[1]!=null).sort((a,b)=>b[1]-a[1]);
    tip.innerHTML = `<b>${y}</b><br>` + rows.map(([p,x]) => `${esc(short(p))}: ${r1(x)}`).join("<br>");
    const px = X(y)/W*r.width; tip.style.left = Math.min(px + 14, r.width - 170) + "px"; tip.style.top = "20px"; tip.style.opacity = "1";
  };
  svg.querySelector("#hit").addEventListener("pointermove", move);
  svg.querySelector("#hit").addEventListener("pointerleave", () => { tip.style.opacity = "0"; cross.setAttribute("opacity","0"); });
}
drawChart();

// ---------- World map ----------
(function(){
  const MM = [["co2","Total, 2024"],["co2_per_capita","Per person, 2024"]];
  const EU27 = new Set(["Austria","Belgium","Bulgaria","Croatia","Cyprus","Czechia","Denmark","Estonia","Finland","France","Germany","Greece","Hungary","Ireland","Italy","Latvia","Lithuania","Luxembourg","Malta","Netherlands","Poland","Portugal","Romania","Slovakia","Slovenia","Spain","Sweden"]);
  let mm = "co2", selected = null, region = null;
  const svgNS = "http://www.w3.org/2000/svg";
  const host = $("#map"), tip = $("#mapTip");
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${GEO.w} ${GEO.h}`); svg.setAttribute("role","group"); svg.setAttribute("aria-label",`World map of ${NC} countries`);
  const sph = document.createElementNS(svgNS, "path"); sph.setAttribute("d", GEO.sphere); sph.setAttribute("class","sphere"); svg.append(sph);
  const els = [];   // every clickable thing: country shapes and pins
  const mk = (tag, n) => { const e = document.createElementNS(svgNS, tag); e._n = n; e.setAttribute("tabindex","0"); e.setAttribute("role","button"); e.setAttribute("aria-label", n); e.classList.add("on"); return e; };
  COUNTRIES.forEach(n => { if (!GEO.shapes[n]) return; const p = mk("path", n); p.setAttribute("d", GEO.shapes[n]); svg.append(p); els.push(p); });
  Object.entries(GEO.pins).forEach(([n,[x,y]]) => { const c = mk("circle", n); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", 2.8); c.classList.add("pinc"); svg.append(c); els.push(c); });
  host.prepend(svg);

  const SHADES = [16,32,52,74,100];
  const shade = k => `color-mix(in srgb, var(--coral) ${SHADES[k]}%, var(--card))`;
  let cuts = [];
  const binOf = x => { let k = 0; while (k < cuts.length && x > cuts[k]) k++; return k; };
  function paint(){
    const vals = COUNTRIES.map(c => val(c, mm, Y1)).filter(x => x != null).sort((a,b)=>a-b);
    cuts = [1,2,3,4].map(q => vals[Math.floor(q*vals.length/5) - 1]);
    els.forEach(e => { const x = val(e._n, mm, Y1); e.style.fill = x == null ? "" : shade(binOf(x)); e.classList.toggle("nodata", x == null); });
    const u = mm === "co2" ? "Mt" : "t";
    $("#legend").innerHTML = `<span>${r1(vals[0])} ${u}</span><span class="bins">${SHADES.map((_,k)=>`<span style="background:${shade(k)}"></span>`).join("")}</span><span>${r1(vals[vals.length-1])} ${u}</span><span class="na"><i></i>No data for ${Y1}</span><span class="na"><i style="border-radius:50%;background:var(--coral)"></i>Dot = small island or state</span>`;
  }
  MM.forEach(([k,l]) => { const b = document.createElement("button"); b.textContent = l; b.setAttribute("aria-pressed", String(k===mm)); b.onclick = () => { mm = k; document.querySelectorAll("#mapSeg button").forEach(x => x.setAttribute("aria-pressed", String(x===b))); paint(); if (selected) showCountry(selected); else if (region) showRegion(region); }; $("#mapSeg").append(b); });

  const sign = n => (n>0?"+":"") + n.toFixed(0) + "%";
  function spark(name){
    const W = 240, H = 44, pts = []; for (let y = Y0; y <= Y1; y++) { const x = val(name, mm, y); if (x!=null) pts.push([y,x]); }
    if (pts.length < 2) return "";
    const mx = Math.max(...pts.map(p=>p[1])), mn = Math.min(...pts.map(p=>p[1]));
    const X = y => 2 + (y-Y0)/(Y1-Y0)*(W-4), Yp = x => 4 + (1-(x-mn)/((mx-mn)||1))*(H-8);
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(name)} trend ${Y0} to ${Y1}"><path d="${pts.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Yp(p[1]).toFixed(1)).join(" ")}" fill="none" stroke="var(--coral)" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${X(pts[pts.length-1][0])}" cy="${Yp(pts[pts.length-1][1])}" r="3.5" fill="var(--coral)"/></svg><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-2)"><span>${Y0}</span><span>${Y1}</span></div>`;
  }
  function stats(name){
    const t = val(name,"co2",Y1), pcap = val(name,"co2_per_capita",Y1), sh = val(name,"share_global_co2",Y1), a = val(name,"co2",Y0), ch = a ? (t/a-1)*100 : null;
    return `<dl><dt>Total ${Y1}</dt><dd>${r1(t)} Mt</dd><dt>Per person</dt><dd>${pcap==null?"–":r1(pcap)+" t"}</dd>${sh!=null?`<dt>Share of world</dt><dd>${sh.toFixed(sh<0.1?2:1)}%</dd>`:""}${ch!=null?`<dt>Change since ${Y0}</dt><dd style="color:${ch>0?"var(--coral)":"var(--teal)"}">${sign(ch)}</dd>`:""}</dl>`;
  }
  function claimFor(name){
    const n = name === "United States" ? "The United States" : name === "United Kingdom" ? "The UK" : name === "European Union (27)" ? "The EU" : name === "World" ? "The world" : name;
    return mm === "co2_per_capita" ? `${n} emits more CO₂ per person than the world average.` : `${n}'s CO₂ emissions were lower in ${Y1} than in ${Y0}.`;
  }
  const panelActs = () => `<div class="acts"><button class="btn" id="mpCheck">Check a claim</button><button class="btn soft" id="mpChart">Add to chart</button></div>`;
  function wireActs(name){
    $("#mpCheck").onclick = () => { $("#claim").value = claimFor(name); scrollTo({top:0,behavior:reduce?"auto":"smooth"}); setTimeout(()=>$("#claim").focus({preventScroll:true}),350); };
    $("#mpChart").onclick = () => addToChart(name);
  }
  function clearSel(){ els.forEach(p => p.classList.remove("sel","hl")); svg.classList.remove("dim"); document.querySelectorAll("#regions button").forEach(b => b.setAttribute("aria-pressed","false")); }
  function showCountry(name){
    selected = name; region = null; clearSel();
    els.forEach(p => p.classList.toggle("sel", p._n === name));
    const x = val(name, mm, Y1);
    const rk = x == null ? null : COUNTRIES.filter(c => val(c,mm,Y1) != null).sort((a,b)=>val(b,mm,Y1)-val(a,mm,Y1)).indexOf(name) + 1;
    const nr = COUNTRIES.filter(c => val(c,mm,Y1) != null).length;
    $("#mapPanel").innerHTML = `<div class="pname">${esc(name)}</div><div class="pbig">${x == null ? "No data" : r1(x)}</div><div class="punit">${esc(METRICS[mm].unit)} in ${Y1}${rk ? ` · #${rk} of ${nr} countries` : ""}</div>${spark(name)}${stats(name)}${panelActs()}`;
    wireActs(name);
  }
  const REG = [["World","World","Every country combined."],["European Union (27)","EU-27","Outlined: the 27 member states. The data has the EU as one total."],["Africa","Africa","Outlined: African countries, as one total."],["Asia","Asia","Outlined: Asian countries, as one total."],["Europe","Europe","Outlined: European countries (including Russia), as one total."],["North America","N. America","Outlined: North American countries, as one total."],["South America","S. America","Outlined: South American countries, as one total."],["Oceania","Oceania","Outlined: Australia, New Zealand and Pacific islands, as one total."],["High-income countries","High-income","A World Bank income group spread across continents, so it has no single outline."]];
  const inRegion = (n, r) => r === "European Union (27)" ? EU27.has(n) : (GEO.cont[n] === r);
  function showRegion(name){
    selected = null; region = name; clearSel();
    document.querySelectorAll("#regions button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.r === name)));
    const outlined = name !== "World" && name !== "High-income countries";
    els.forEach(p => p.classList.toggle("hl", outlined && inRegion(p._n, name)));
    svg.classList.toggle("dim", outlined);
    const r = REG.find(x => x[0] === name); const x = val(name, mm, Y1);
    $("#mapPanel").innerHTML = `<div class="pname">${esc(r[1])}</div><p class="hint">${esc(r[2])}</p><div class="pbig">${r1(x)}</div><div class="punit">${esc(METRICS[mm].unit)} in ${Y1}</div>${spark(name)}${stats(name)}${panelActs()}`;
    wireActs(name);
  }
  REG.forEach(([k,l]) => { const b = document.createElement("button"); b.dataset.r = k; b.textContent = l; b.setAttribute("aria-pressed","false"); b.onclick = () => region === k ? reset() : showRegion(k); $("#regions").append(b); });
  function reset(){
    selected = null; region = null; clearSel();
    const top = COUNTRIES.slice().sort((a,b)=>val(b,"co2",Y1)-val(a,"co2",Y1)).slice(0,3);
    $("#mapPanel").innerHTML = `<div class="pname">Pick a place</div><p class="hint">Tap any country, search for one, or choose a region below the map.</p><p class="hint" style="margin-top:16px"><b style="color:var(--ink)">Largest emitters in ${Y1}</b></p><dl>${top.map(c=>`<dt>${esc(short(c))}</dt><dd>${r1(val(c,"co2",Y1))} Mt</dd>`).join("")}</dl><p class="hint" style="margin-top:16px">Small islands and city-states show as dots. Anything outside this data, the agent answers "Not in data".</p>`;
  }
  const pick = n => { if (D.iso[n]) showCountry(n); else if (REG.some(r => r[0] === n)) showRegion(n); };
  $("#mapSearch").addEventListener("change", e => { const r = core.resolve(e.target.value); if (r.name) { pick(r.name); e.target.value = ""; $("#mapSearch").blur(); } });
  // interactions
  svg.addEventListener("pointermove", e => {
    const p = e.target.closest(".on"); if (!p) { tip.style.opacity = "0"; return; }
    const n = p._n, r = host.getBoundingClientRect(), a = val(n,"co2",Y1), b = val(n,"co2_per_capita",Y1);
    tip.innerHTML = `<b>${esc(n)}</b><br>${a==null?"No data":r1(a)+" Mt total"}${b==null?"":`<br>${r1(b)} t per person`}`;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    tip.style.left = Math.min(x + 14, r.width - 170) + "px"; tip.style.top = Math.max(y - 70, 0) + "px"; tip.style.opacity = "1";
  });
  svg.addEventListener("pointerleave", () => tip.style.opacity = "0");
  svg.addEventListener("click", e => { const p = e.target.closest(".on"); if (p) showCountry(p._n); });
  svg.addEventListener("keydown", e => { const p = e.target.closest(".on"); if (p && (e.key==="Enter"||e.key===" ")) { e.preventDefault(); showCountry(p._n); } });
  paint(); reset();
})();

// Facts that turn into claims
(function(){
  const sh = val("China","share_global_co2",2024), uk = (val("United Kingdom","co2",2024)/val("United Kingdom","co2",1990)-1)*100, sa = val("Saudi Arabia","co2_per_capita",2024), w = val("World","co2_per_capita",2024);
  const f = [["a",`${sh.toFixed(0)}%`,`of the world's fossil CO₂ came from China in 2024.`,"G1"],["b",`${uk.toFixed(0)}%`,`change in UK emissions between 1990 and 2024.`,"G4"],["c",`${sa.toFixed(1)} t`,`of CO₂ per person in Saudi Arabia, against a world average of ${w.toFixed(1)} t.`,"G8"]];
  $("#facts").innerHTML = f.map(([c,n,t,id]) => `<div class="fact ${c}"><div class="n">${n}</div><p>${t}</p><button class="try" data-g="${id}">Check a related claim</button></div>`).join("");
  $("#facts").querySelectorAll(".try").forEach(b => b.onclick = () => { const g = G.find(x=>x.id===b.dataset.g); check(g.text); });
})();

// ---------- Scorecard ----------
$("#scoreH").textContent = `${G.length} claims with known answers`; $("#ringOf").textContent = `of ${G.length} correct`; $("#evalBtn").textContent = `Run all ${G.length}`; $("#ringTxt").textContent = `Pass bar: ${PASS_AT} of ${G.length}, with zero wrong numbers.`;
function setRing(n){ $("#ring").style.strokeDashoffset = String(314.16 * (1 - n/G.length)); $("#ringNum").textContent = n; }
function renderEvals(R){
  $("#evalBody").innerHTML = G.map(g => { const r = R && R[g.id];
    const a = !r ? `<span class="tag none">Not run</span>` : r === "running" ? `<span class="tag wait">Checking…</span>` : r.error ? `<span class="tag REFUTED">${esc(r.error)}</span>` : `<span class="tag ${r.verdict||"none"}">${LABEL[r.verdict]||"None"}</span> ${r.verdict===g.expected?'<b style="color:var(--teal)">✓</b>':'<b style="color:var(--coral)">✕</b>'}`;
    const n = !r || r==="running" || r.error ? "" : r.nfig ? `${r.nfig-r.bad} of ${r.nfig} right` : "none";
    return `<tr><td>${esc(g.text)}</td><td><span class="tag ${g.expected}">${LABEL[g.expected]}</span></td><td>${a}</td><td style="${r&&r.bad?"color:var(--coral);font-weight:700":""}">${n}</td></tr>`; }).join("");
}
renderEvals();
$("#evalBtn").onclick = async () => {
  if (busy || MODE === "replay") return; busy = true; $("#evalBtn").disabled = true; $("#goBtn").disabled = true;
  const R = {}; let right = 0, wrong = 0; setRing(0); const noop = () => {};
  for (const g of G) {
    R[g.id] = "running"; renderEvals(R); $("#evalStatus").textContent = `Checking claim ${G.indexOf(g)+1} of ${G.length}…`;
    try {
      const out = MODE === "claude" ? await agentClaude(g.text, noop, undefined, $("#tier").value) : await agentServer(g.text, noop);
      core.verify(out.state, g.expected); const bad = out.state.figures.filter(f => !f.ok).length;
      R[g.id] = { verdict: out.state.verdict, nfig: out.state.figures.length, bad };
      if (out.state.verdict === g.expected) right++; wrong += bad;
      logRun({ claim: g.text, when: new Date().toLocaleString(), mode: "scorecard", verdict: out.state.verdict, pass: out.state.verdict === g.expected && !bad });
    } catch (e) { R[g.id] = { error: ERR[e&&e.code] ? "Stopped" : "Interrupted" }; if (e && ["rate_limited","not_granted","access_code","not_configured"].includes(e.code)) { renderEvals(R); $("#evalStatus").textContent = ERR[e.code]; break; } }
    renderEvals(R); setRing(right);
  }
  const ok = right >= PASS_AT && wrong === 0;
  $("#evalStatus").innerHTML = `${right} of ${G.length} rulings right, ${wrong} wrong number${wrong===1?"":"s"}. <b style="color:${ok?"var(--teal)":"var(--coral)"}">${ok?"Meets the pass bar.":"Below the pass bar."}</b>`;
  busy = false; $("#evalBtn").disabled = false; $("#goBtn").disabled = false;
};

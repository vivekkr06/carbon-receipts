# Carbon Receipts

An AI agent that fact-checks claims about national CO₂ emissions against Our World in Data (CC BY 4.0).
215 countries and 9 regions, 1990–2024. Every number the agent quotes is re-checked against the data before you see it.

## Deploy (Netlify)

1. Put these files at the **top level** of a GitHub repo (index.html, app.js, package.json, netlify.toml, data/, lib/, netlify/).
2. Netlify → Add new site → Import from Git. Leave build command and publish directory blank.
3. Site settings → Environment variables:

| Variable | Needed? | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Switches on live checking |
| `ACCESS_CODE` | optional | Only people with the code can run live checks |
| `DAILY_CHECK_CAP` | optional | Max model-backed checks per UTC day (default 300) |
| `ADMIN_CODE` | optional | Lets you read 👍/👎 feedback at `/api/feedback?code=YOUR_CODE` |
| `ANTHROPIC_MODEL` | no | Leave unset unless you want a specific model |

4. Redeploy after changing any variable (variables apply to new deploys only).

## What protects your credits

1. **Rate limit**: 15 checks per minute per visitor (Netlify, in `check.mjs`), 12 feedback posts per minute.
2. **Saved answers**: a claim that was answered *and fully verified* is stored for 30 days and re-served with no model call.
   Rewording a claim counts as a new claim. Changing the data or prompt version invalidates saved answers automatically.
3. **Daily cap**: `DAILY_CHECK_CAP` stops model calls for the day (saved answers still work).
4. **Access code**: optional.

Saved answers, the daily counter and feedback live in Netlify Blobs (no setup; works on the free plan).
If Blobs is ever unavailable the site keeps working, it just skips saving.

## Local preview

The page loads its data as files, so open it through a server, not by double-clicking:
`python3 -m http.server` then visit http://localhost:8000. Without the functions it runs in Demo mode.
For full local testing: `npx netlify dev` (needs the Netlify CLI and your env vars).

## Files

- `index.html`, `app.js`: the site (ES module, no build step)
- `lib/core.mjs`: the agent's tools, prompt and verifier (shared by browser and server)
- `lib/store.mjs`: storage wrapper
- `netlify/functions/check.mjs`: streaming agent endpoint `/api/check`
- `netlify/functions/feedback.mjs`: `/api/feedback`
- `data/co2.json`, `data/geo.json`: data and map (generated from OWID and Natural Earth via world-atlas)

## Data

Our World in Data CO₂ dataset (github.com/owid/co2-data), territorial fossil CO₂ unless stated.
`consumption_co2` exists for about 120 countries and ends in 2023; the agent says "Not in data" when a value is missing.

## Troubleshooting

| Code on the page | Meaning | Fix |
|---|---|---|
| `server_auth` | API key rejected | Check `ANTHROPIC_API_KEY`, redeploy |
| `server_credits` | Anthropic account out of credit | Top up at console.anthropic.com |
| `server_model` | Model name rejected | Delete `ANTHROPIC_MODEL`, redeploy |
| `rate_limited` | Too many requests | Wait a minute |
| `daily_cap` | Daily cap reached | Raise `DAILY_CHECK_CAP` or wait for 00:00 UTC |
| `timeout` / `platform_timeout` | Took longer than ~22 s | Try again |

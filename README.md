# Claim Check

An AI agent that fact-checks claims about national CO₂ emissions against
Our World in Data, built in nine steps (spec → instructions → tools → loop →
memory → guardrails → checks → golden dataset → continuous evals).

## What's in here

| Path | What it is |
|---|---|
| `index.html` | The whole website (data embedded, no build step) |
| `netlify/functions/check.mjs` | Server function that runs the agent loop with your API key |
| `lib/core.mjs` | The agent's tools, instructions and checks (shared with the page) |
| `data/co2.json` | Snapshot of the OWID dataset, 26 places, 1990–2024 |
| `netlify.toml` | Netlify settings |

## Deploy on Netlify

1. Push this folder to a new GitHub repository.
2. In Netlify: **Add new site → Import an existing project →** pick the repo.
   Leave the build command empty; publish directory is `.`.
3. In **Site configuration → Environment variables**, add:
   - `ANTHROPIC_API_KEY` = your key from console.anthropic.com (required for live mode)
   - `ANTHROPIC_MODEL` = optional, defaults to `claude-haiku-4-5-20251001`
   - `ACCESS_CODE` = optional; if set, visitors need this code to run live checks
4. Redeploy. The badge in the top right switches from "Demo mode" to "Live".

Without an API key the site still works: the example claims replay how the agent
reasons, and everything else (chart, nine-step tour, scorecard table) is visible.

## Keep costs under control

- Set a monthly spend limit on your Anthropic account.
- Each check is at most 6 model calls with 1,024 output tokens each.
- Use `ACCESS_CODE` if you share the link widely and only want to demo live yourself.

## Local preview

```
npm install -g netlify-cli
netlify dev
```

Then open http://localhost:8888. Put your key in a `.env` file (`ANTHROPIC_API_KEY=...`); it's git-ignored.

## Data

Our World in Data, CO₂ and greenhouse gas emissions (https://github.com/owid/co2-data),
CC BY 4.0. To refresh, download `owid-co2-data.csv` and rebuild `data/co2.json`
with the same shape, then rerun the scorecard (step 9).

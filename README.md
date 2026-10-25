# Carbon Receipts

> **Deterministic fact-checking for national emissions claims.**  
> An open-source reference implementation of an evaluation-driven agent pipeline built on Claude and Our World in Data.

Carbon Receipts cross-references public climate claims against a curated baseline of 215 countries and 9 regions (1990–2024). Every figure quoted by the agent is programmatically audited against ground truth before rendering.

---

## Architecture: The 9-Step Pattern

This project implements an end-to-end agentic workflow:

1. **Define the Job:** Input claim → Output structured verdict (`Verified`, `Refuted`, `Misleading`) with calculation traces.
2. **Write Instructions:** Strict system prompts with few-shot domain examples (e.g., territorial vs. consumption metrics).
3. **Give It Tools:** Deterministic lookup functions over static JSON datasets; zero hallucinated web retrievals.
4. **Control the Loop:** Bounded execution capped at 6 model turns and strict output token limits.
5. **Add Memory & Cache:** Caching of verified responses in Netlify Blobs to reduce redundant compute.
6. **Set Guardrails:** Closed-domain sandbox rejecting unsupported years, out-of-scope entities, or unbounded extrapolation.
7. **Check the Result:** Programmatic verifier auditing all cited figures against raw data records prior to client streaming.
8. **Build a Golden Dataset:** Pre-computed test assertions across edge cases (missing historical points, small territories).
9. **Run Continuous Evals:** Dynamic scorecard testing accuracy, tool selection, and citation integrity across updates.

---

## Cost & Safety Guardrails

Running live agents publicly requires strict financial and compute safeguards:

- **Programmatic Verifier & Cache:** Fully audited claims are stored in Netlify Blobs for 30 days and re-served at zero model cost.
- **Rate Limiting:** 15 checks/minute per visitor and 12 feedback requests/minute.
- **Daily Spend Hard-Cap:** `DAILY_CHECK_CAP` halts live model calls once reached, gracefully falling back to demo and cached queries.
- **Gatekeeping:** Optional `ACCESS_CODE` parameter allows private sharing and live demos without open public exposure.

---

## Deployment (Netlify)

### 1. Push to GitHub
Place all files directly in the repository root (`index.html`, `app.js`, `lib/`, `netlify/`, etc.).

### 2. Connect to Netlify
1. Go to **Netlify → Add new site → Import an existing project**.
2. Select your repository.
3. Leave **Build command** and **Publish directory** completely blank.

### 3. Environment Variables
Under **Site configuration → Environment variables**, configure:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | Anthropic API key to enable live model reasoning. |
| `ACCESS_CODE` | Optional | Password-protects live execution for private evaluations. |
| `DAILY_CHECK_CAP` | Optional | Maximum model-backed executions per UTC day (default: `300`). |
| `ADMIN_CODE` | Optional | Secure key to inspect user feedback at `/api/feedback?code=...`. |
| `ANTHROPIC_MODEL` | Optional | Target model override (defaults to `claude-haiku-4-5-20251001`). |

*Note: Redeploy your site whenever you update environment variables.*

---

## Local Development

Because datasets are loaded as discrete ES modules and JSON assets, serve the project through a local HTTP server:

```bash
# Lightweight static preview (runs in Demo mode)
python3 -m http.server 8000

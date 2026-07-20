# Route Pilote 🧭

**A Bloomberg Terminal for your supply chain.**

Route Pilote predicts supply-chain disruptions, freight cost increases and shipping delays *before*
they impact a shipment. Enter a product, origin, destination, weight and ship date — a fleet of AI
agents scans live web intelligence (via Tavily) and returns a single actionable risk score,
cost/delay forecasts, route optimization and recommended actions.

![flow](https://img.shields.io/badge/agents-12-2dd4bf) ![data](https://img.shields.io/badge/intelligence-Tavily-38bdf8)

---

## What it does

Input a shipment → Route Pilote runs a multi-agent pipeline:

| Agent | Role |
| ----- | ---- |
| Product & Material | Category, HS codes, raw-material decomposition (e.g. Plastic 80% / Steel 15% / Packaging 5%) |
| Commodity Intelligence | Oil, resin, steel, metals cost exposure |
| Freight Intelligence | Ocean/air container rates, capacity, route disruptions |
| Port Intelligence | Congestion, vessel queues, throughput |
| Weather Intelligence | Typhoons, storms, seasonal disruption |
| Geopolitical Intelligence | Tariffs, sanctions, Red Sea / conflict risk |
| Supplier Intelligence | Manufacturing PMI, factory health |
| Regulatory Intelligence | Customs & classification changes |
| Cost / Route / Alert Engine | 30/60/90-day forecasts, mode comparison, alerts |
| Executive Summary | Plain-language briefing |
| Action Plan | Prioritized, deadline-sorted to-do list |
| Port Recommendation | Live congestion comparison across alternative entry ports |
| Tariff & Regulation | Real-time duty rates, documents checklist, compliance notes |

Output: **Global Risk Score**, **Expected Cost Increase**, **Expected Delay**, commodity exposure,
cost-forecast charts, route table, dependency graph, live news feed and recommended actions.

## How Tavily powers it

Every intelligence agent queries the live web through the **Tavily REST API**
(`@tavily/core` SDK), using the `search` and `extract` endpoints:

- **`search`** — retrieves top web results for freight rates, port congestion, commodity news, tariffs, and weather forecasts. Supports `searchDepth` (`basic`/`advanced`), topic filtering, and configurable result counts.
- **`extract`** — pulls structured content from a specific URL into raw text for deeper source analysis.

`src/lib/tavily.ts` is the integration layer. If no API key is configured (or a call fails) it
degrades gracefully to a realistic built-in dataset so the demo never breaks — shown as
**● DEMO DATA** vs **● LIVE DATA** in the header.

## How Mistral AI powers it

All agent reasoning runs through **Mistral AI** via the OpenAI-compatible REST endpoint.
`src/lib/openai.ts` wraps the Mistral API using the `openai` npm SDK pointed at
`https://api.mistral.ai/v1` — no extra SDK needed. Every `jsonCompletion` and `textCompletion`
call uses `mistral-small-latest` by default (configurable via `MISTRAL_MODEL`).

## Architecture

```
src/
  app/
    page.tsx              # landing + conversational intake (IntakeChat) + live agent console + dashboard
    layout.tsx            # global metadata + fonts
    api/
      analyze/route.ts    # SSE streaming pipeline endpoint (POST → ReadableStream)
      parse/route.ts      # lightweight intake NLP endpoint (POST → IntakeResult JSON)
  lib/
    types.ts              # domain model (ShipmentInput, AnalysisResult, RiskFactor, Source, …)
    tavily.ts             # Tavily REST client + graceful mock fallback
    openai.ts             # Mistral AI wrapper (OpenAI-compatible interface)
    agents.ts             # product, 7 intelligence agents, synthesis, executive summary, action plan
    orchestrator.ts       # runs the pipeline, weighted risk score, streams SSE events
    drivers.ts            # seeds DependencyDriver objects from product materials + risk factors
    geo.ts                # lightweight geocoding (city → lat/lng) for the RouteMap
    utils.ts              # shared helpers
  components/
    Header.tsx            # sticky header with LIVE/DEMO data badge and provider credit
    IntakeChat.tsx        # conversational form — multi-turn NLP to collect ShipmentInput
    AnalyzeForm.tsx       # quick-fill preset picker + form wrapper
    AgentConsole.tsx      # real-time SSE agent status panel
    Dashboard.tsx         # full results dashboard (Recharts charts, risk cards, news feed, maps)
    DependencyGraph.tsx   # interactive supply-chain dependency graph (SVG)
    RouteMap.tsx          # Leaflet map showing origin → destination route + alternative ports
```

The pipeline **streams** progress over Server-Sent Events, so the UI shows each agent light up live.

## Tech

Next.js 16 · React 19 · TypeScript · TailwindCSS v4 · Recharts · Framer Motion · Leaflet · Mistral AI · Tavily.

## Run it

```bash
cp .env.example .env.local   # add MISTRAL_API_KEY and TAVILY_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

Click a preset (e.g. *10,000 Plastic Chairs · Shanghai → LA*) and hit **Run Risk Analysis**.

> Runs end-to-end with **no keys** using the built-in fallback dataset. Add keys for live web
> intelligence and real LLM reasoning.

### Environment

| Var | Purpose |
| --- | ------- |
| `MISTRAL_API_KEY` | LLM reasoning for the agents (via Mistral AI) |
| `MISTRAL_MODEL` | optional, defaults to `mistral-small-latest` |
| `TAVILY_API_KEY` | live web search/extract via Tavily REST API |
| `TAVILY_SEARCH_DEPTH` | optional, `basic` (default) or `advanced` — controls depth and credit cost |

---

Built with Next.js + Mistral AI + **Tavily**.

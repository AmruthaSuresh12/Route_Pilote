// Tavily web-intelligence integration layer.
//
// Adapter module that wraps the @tavily/core REST SDK and exposes the same
// interface consumed by agents.ts and orchestrator.ts.
//
// Primary path: @tavily/core REST SDK (client.search / client.extract).
//   Uses TAVILY_API_KEY from the environment.
//   TAVILY_SEARCH_DEPTH ("basic" | "advanced") controls depth/cost.
//
// Fallback path: if no API key is configured (or a call fails) we degrade
//   gracefully to realistic synthetic results so the demo never breaks on
//   stage. `dataMode` in the final result reflects which path was used.

import { tavily } from "@tavily/core";
import type { Source } from "./types";

const API_KEY = process.env.TAVILY_API_KEY || "";
const SEARCH_DEPTH =
  process.env.TAVILY_SEARCH_DEPTH === "advanced" ? "advanced" : "basic";

// Lazy-initialised client — only created when a real key is present.
let _client: ReturnType<typeof tavily> | null = null;

function getClient(): ReturnType<typeof tavily> | null {
  if (!API_KEY) return null;
  if (!_client) {
    try {
      _client = tavily({ apiKey: API_KEY });
    } catch (err) {
      console.error("[tavily] client init failed:", err);
      return null;
    }
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Live-mode tracking
// ---------------------------------------------------------------------------

let liveUsed = false;

export function brightDataMode(): "live" | "mock" {
  return liveUsed ? "live" : "mock";
}

// ---------------------------------------------------------------------------
// Per-analysis search transparency log
// ---------------------------------------------------------------------------

export interface SearchLogEntry {
  query: string;
  results: number;
  mode: "live" | "mock";
  sources: Source[];
}

let searchLog: SearchLogEntry[] = [];

export function resetSearchLog(): void {
  searchLog = [];
}

export function getSearchLog(): SearchLogEntry[] {
  return searchLog;
}

// ---------------------------------------------------------------------------
// Source normalisation helpers
// ---------------------------------------------------------------------------

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error("timeout")), ms),
    ),
  ]);

/** Map Tavily search results to our Source[] shape. */
function tavilyResultsToSources(
  results: Array<{ title?: string; url?: string; content?: string }>,
  limit: number,
): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const r of results) {
    if (!r.title || !r.url) continue;
    if (seen.has(r.url)) continue;
    if (/google\.com\/(search|aclk)|gstatic|w3\.org/.test(r.url)) continue;
    seen.add(r.url);
    sources.push({
      title: r.title.trim(),
      url: r.url.trim(),
      snippet: r.content?.slice(0, 200).trim() || undefined,
    });
    if (sources.length >= limit) break;
  }
  return sources;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Live web search via Tavily `search` API (Google-quality results). */
export async function bdSearch(query: string, limit = 5): Promise<Source[]> {
  const client = getClient();
  if (client) {
    try {
      const res = await withTimeout(
        client.search(query, {
          searchDepth: SEARCH_DEPTH,
          maxResults: Math.min(limit + 2, 10), // fetch a couple extra so dedup still hits `limit`
          includeAnswer: false,
          topic: "general",
        }),
        18_000, // fall back to mock rather than stalling the pipeline
      );
      const sources = tavilyResultsToSources(res.results ?? [], limit);
      if (sources.length) {
        liveUsed = true;
        searchLog.push({ query, results: sources.length, mode: "live", sources });
        return sources;
      }
    } catch (err) {
      console.error(`[tavily] search "${query}" failed:`, err);
    }
  }
  const mock = mockSearch(query, limit);
  searchLog.push({ query, results: mock.length, mode: "mock", sources: mock });
  return mock;
}

/** Extract a single URL to markdown text via Tavily `extract` API. */
export async function bdScrape(url: string): Promise<string> {
  const client = getClient();
  if (client) {
    try {
      const res = await withTimeout(
        client.extract([url], { extractDepth: "basic" }),
        45_000,
      );
      const content = (res.results as Array<{ rawContent?: string }>)?.[0]?.rawContent ?? "";
      if (content) {
        liveUsed = true;
        return content;
      }
    } catch (err) {
      console.error(`[tavily] extract "${url}" failed:`, err);
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Mock fallback — realistic synthetic results for demo/offline mode.
// ---------------------------------------------------------------------------

function host(seed: string, base: string): string {
  return `https://${base}/${encodeURIComponent(seed.toLowerCase().replace(/\s+/g, "-")).slice(0, 40)}`;
}

function mockSearch(query: string, limit: number): Source[] {
  const q = query.toLowerCase();
  const pick = (arr: Source[]) => arr.slice(0, limit);

  if (/freight|container|shipping rate|ocean/.test(q)) {
    return pick([
      { title: "Drewry World Container Index holds steady week-on-week", url: host(query, "drewry.co.uk"), snippet: "Composite index at $2,310 per 40ft container; Shanghai–LA lane up 3% on capacity tightening." },
      { title: "Freightos Baltic Index: Transpacific rates edge higher", url: host(query, "freightos.com"), snippet: "Spot rates on the China–US West Coast trade rose amid peak-season front-loading." },
      { title: "Carriers announce GRI for transpacific routes", url: host(query, "joc.com"), snippet: "General Rate Increase of $600/FEU planned as blank sailings tighten available space." },
    ]);
  }
  if (/port|congestion|berth|vessel queue/.test(q)) {
    return pick([
      { title: "LA/Long Beach dwell times tick up as imports rise", url: host(query, "porttechnology.org"), snippet: "Container dwell time climbed to 4.1 days; vessel queue forming offshore." },
      { title: "Pacific Merchant Shipping Assn signals labor uncertainty", url: host(query, "freightwaves.com"), snippet: "Ongoing negotiations raise risk of slowdowns at West Coast terminals." },
    ]);
  }
  if (/oil|crude|brent|wti|natural gas|resin|plastic/.test(q)) {
    return pick([
      { title: "Brent crude rises on supply concerns", url: host(query, "reuters.com"), snippet: "Oil up 4% week-on-week; downstream petrochemical and resin feedstock costs expected to follow." },
      { title: "Polypropylene resin prices firm in Asia", url: host(query, "icis.com"), snippet: "Spot PP resin gained on higher propylene; converters face margin pressure." },
    ]);
  }
  if (/steel|aluminum|copper|metal/.test(q)) {
    return pick([
      { title: "Steel benchmark prices steady amid soft demand", url: host(query, "spglobal.com"), snippet: "HRC prices flat; mills hold output as construction demand cools." },
    ]);
  }
  if (/typhoon|weather|storm|hurricane|flood/.test(q)) {
    return pick([
      { title: "South China Sea typhoon season outlook", url: host(query, "tropicaltidbits.com"), snippet: "Forecasters expect above-average tropical activity; shipping lanes may face periodic disruption." },
      { title: "JMA issues storm advisory near major shipping lanes", url: host(query, "jma.go.jp"), snippet: "Vessels advised to monitor developing systems off the southern coast." },
    ]);
  }
  if (/tariff|trade war|sanction|geopolit|export restriction/.test(q)) {
    return pick([
      { title: "US reviews Section 301 tariffs on Chinese goods", url: host(query, "ustr.gov"), snippet: "Potential adjustments to tariff lines covering consumer and industrial imports under review." },
      { title: "Red Sea diversions continue to lengthen some routes", url: host(query, "lloydslist.com"), snippet: "Carriers maintain Cape of Good Hope routing on select services." },
    ]);
  }
  if (/supplier|manufactur|factory|bankrupt|strike|pmi/.test(q)) {
    return pick([
      { title: "China Caixin manufacturing PMI signals modest expansion", url: host(query, "tradingeconomics.com"), snippet: "PMI at 50.8; new export orders mixed amid uneven global demand." },
      { title: "Guangdong factories report stable order books", url: host(query, "scmp.com"), snippet: "Consumer-goods manufacturers see steady but cautious Q3 outlook." },
    ]);
  }
  return pick([
    { title: `Logistics intelligence: ${query}`, url: host(query, "supplychaindive.com"), snippet: "Latest developments relevant to global supply chains and shipping." },
    { title: `Market brief: ${query}`, url: host(query, "splash247.com"), snippet: "Industry coverage of conditions affecting freight and trade flows." },
  ]);
}

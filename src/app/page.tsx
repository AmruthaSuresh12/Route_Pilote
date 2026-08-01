"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { Header } from "@/components/Header";
import { AnalyzeForm, PRESETS } from "@/components/AnalyzeForm";
import { IntakeChat } from "@/components/IntakeChat";
import { AgentConsole, type AgentState } from "@/components/AgentConsole";
import { Dashboard } from "@/components/Dashboard";
import { AlertCenter } from "@/components/AlertCenter";
import type { AnalysisResult, AnalyzeEvent, ShipmentInput, PredictiveAlert } from "@/lib/types";

type Phase = "idle" | "running" | "done";

function mapTitleToCategory(title: string): "freight" | "port" | "weather" | "commodity" | "supplier" | "regulatory" | "tariff" | "geopolitical" {
  const t = title.toLowerCase();
  if (/port|berth|dwell|vessel|congestion/i.test(t)) return "port";
  if (/weather|typhoon|storm|cyclone|monsoon|climate|rain/i.test(t)) return "weather";
  if (/commodity|price|resin|metal|steel|oil|fuel/i.test(t)) return "commodity";
  if (/supplier|factory|production|manufacturer/i.test(t)) return "supplier";
  if (/regulatory|compliance|policy|customs/i.test(t)) return "regulatory";
  if (/tariff|duty|tax|duties/i.test(t)) return "tariff";
  if (/geopolitical|war|strike|sanction|trade war|border/i.test(t)) return "geopolitical";
  return "freight"; // fallback
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<ShipmentInput | null>(null);
  const [manual, setManual] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Predictive Alert Center States
  const [alerts, setAlerts] = useState<PredictiveAlert[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [alertCenterOpen, setAlertCenterOpen] = useState(false);
  const [dynamicRiskScore, setDynamicRiskScore] = useState<number | null>(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [showInfoPopup, setShowInfoPopup] = useState(false);

  useEffect(() => {
    if (showInfoPopup) {
      const timer = setTimeout(() => {
        setShowInfoPopup(false);
      }, 9000);
      return () => clearTimeout(timer);
    }
  }, [showInfoPopup]);

  const handleMarkRead = useCallback((id: string) => {
    setUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleMarkAllRead = useCallback(() => {
    setUnreadIds(new Set());
  }, []);

  const handleResolveAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            status: "resolved",
            severity: "low",
            timeline: [
              ...a.timeline,
              {
                event: "Alert resolved",
                timestamp: new Date().toISOString(),
                description: "Resolved manually by user after reviewing recommendation.",
              },
            ],
          };
        }
        return a;
      })
    );
    setDynamicRiskScore((prev) => Math.max(0, (prev || 50) - 5));
  }, []);

  const upsertAgent = useCallback((a: AgentState) => {
    setAgents((prev) => {
      const idx = prev.findIndex((p) => p.id === a.id);
      if (idx === -1) return [...prev, a];
      const next = [...prev];
      next[idx] = a;
      return next;
    });
  }, []);

  const run = useCallback(
    async (input: ShipmentInput) => {
      setActive(input);
      setPhase("running");
      setAgents([]);
      setLogs([]);
      setResult(null);
      setError(null);
      setAlerts([]);
      setUnreadIds(new Set());
      setAlertCenterOpen(false);
      setDynamicRiskScore(null);
      setActiveAnalysisId(null);
      setShowInfoPopup(false);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            let evt: AnalyzeEvent;
            try {
              evt = JSON.parse(json);
            } catch {
              continue;
            }
            if (evt.type === "agent") {
              upsertAgent({ id: evt.id, name: evt.name, status: evt.status, summary: evt.summary });
            } else if (evt.type === "log") {
              setLogs((p) => [...p, evt.message]);
            } else if (evt.type === "result") {
              setResult(evt.data);
              setDynamicRiskScore(evt.data.riskScore);
              const analysisId = Math.random().toString(36).substring(7);
              setActiveAnalysisId(analysisId);

              // Seed initial alerts
              const seeded = evt.data.alerts.map((a, i) => ({
                id: `seeded-${analysisId}-${i}`,
                title: a.title,
                category: mapTitleToCategory(a.title),
                severity: (a.severity === "high" ? "high" : a.severity === "medium" ? "medium" : "low") as any,
                explanation: a.impact,
                why: "Baseline shipment risk identified during live routing analysis.",
                businessImpact: "Direct exposure on transport lane, raising expected delivery variance.",
                recommendation: evt.data.recommendations[i]?.action || "Lock freight contracts and buffer dispatch date.",
                confidence: 85,
                timestamp: new Date().toISOString(),
                status: "active" as const,
                timeline: [
                  {
                    event: "Alert generated",
                    timestamp: new Date().toISOString(),
                    description: "Shipment assessment completed."
                  }
                ]
              }));
              setAlerts(seeded);
              setUnreadIds(new Set(seeded.map(s => s.id)));
              setPhase("done");
              setShowInfoPopup(true);
            } else if (evt.type === "error") {
              setError(evt.message);
              setPhase("done");
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Analysis failed");
          setPhase("done");
        }
      }
    },
    [upsertAgent],
  );

  const reset = () => {
    abortRef.current?.abort();
    setPhase("idle");
    setResult(null);
    setError(null);
    setAgents([]);
    setManual(false);
    setAlerts([]);
    setUnreadIds(new Set());
    setAlertCenterOpen(false);
    setDynamicRiskScore(null);
    setActiveAnalysisId(null);
    setShowInfoPopup(false);
  };

  useEffect(() => {
    if (phase !== "done" || !result || !activeAnalysisId) return;

    const simulationTimeline = [
      {
        time: 15000,
        action: () => {
          const newAlert: PredictiveAlert = {
            id: `sim-weather-${activeAnalysisId}`,
            title: "Typhoon Approaching East China Sea",
            category: "weather",
            severity: "high",
            explanation: "A Category 3 Typhoon is tracking directly into key shipping lanes, likely causing 3-5 day vessel departure delays.",
            why: "Satellite meteorological models show wind speeds exceeding 55 knots with high probability of ocean lane closures.",
            businessImpact: "Potential breach of delivery SLA, causing secondary warehouse storage fees at destination.",
            recommendation: "Book shipment earlier or reroute through southern rail corridor.",
            confidence: 90,
            timestamp: new Date().toISOString(),
            status: "active",
            timeline: [
              {
                event: "Alert generated",
                timestamp: new Date().toISOString(),
                description: "Typhoon formation tracked off coastal waters."
              }
            ]
          };
          setAlerts(prev => [newAlert, ...prev]);
          setUnreadIds(prev => new Set([...prev, newAlert.id]));
          setDynamicRiskScore(prev => Math.min(100, (prev || result.riskScore) + 8));
        }
      },
      {
        time: 35000,
        action: () => {
          const newAlert: PredictiveAlert = {
            id: `sim-port-${activeAnalysisId}`,
            title: "Berth Congestion Spike at Port of LA",
            category: "port",
            severity: "critical",
            explanation: "Dry-van railcar shortage at terminal gates has caused container dwell time to jump to 6.2 days.",
            why: "BNSF and Union Pacific reported a 25% shortage of active crews, blocking off-dock intermodal transfers.",
            businessImpact: "Demurrage charges of $180/day per container starting after day 4 of port arrival.",
            recommendation: "Consider alternative ports (Oakland/Seattle) or pre-arrange truck-carrier drayage.",
            confidence: 94,
            timestamp: new Date().toISOString(),
            status: "active",
            timeline: [
              {
                event: "Alert generated",
                timestamp: new Date().toISOString(),
                description: "Congestion threshold breached; terminal gate queues exceed 2.4 miles."
              }
            ]
          };
          setAlerts(prev => [newAlert, ...prev]);
          setUnreadIds(prev => new Set([...prev, newAlert.id]));
          setDynamicRiskScore(prev => Math.min(100, (prev || result.riskScore) + 12));
        }
      },
      {
        time: 55000,
        action: () => {
          setAlerts(prev => prev.map(a => {
            if (a.id === `sim-weather-${activeAnalysisId}`) {
              return {
                ...a,
                status: "resolved",
                severity: "low",
                explanation: "Typhoon trajectory shifted 120 miles northeast into open ocean, clearing scheduled lane corridors.",
                timeline: [
                  ...a.timeline,
                  {
                    event: "Risk decreased",
                    timestamp: new Date(Date.now() - 20000).toISOString(),
                    description: "Storm downgraded to Category 1 tropical storm."
                  },
                  {
                    event: "Alert resolved",
                    timestamp: new Date().toISOString(),
                    description: "Lane declared safe. Original shipment schedule can proceed."
                  }
                ]
              };
            }
            return a;
          }));
          setDynamicRiskScore(prev => Math.max(0, (prev || result.riskScore) - 6));
        }
      },
      {
        time: 75000,
        action: () => {
          const newAlert: PredictiveAlert = {
            id: `sim-tariff-${activeAnalysisId}`,
            title: "Tariff Exclusion Review Pending",
            category: "tariff",
            severity: "medium",
            explanation: "Customs authorities announced expiration of Section 301 list exclusions, impacting commodity imports.",
            why: "Official trade representative notice updated imports starting next month, raising duty risk by 7.5%.",
            businessImpact: "Estimated addition of $2,300 in customs duties on standard container shipments.",
            recommendation: "Verify tariff classification codes immediately and pre-file customs entry.",
            confidence: 82,
            timestamp: new Date().toISOString(),
            status: "active",
            timeline: [
              {
                event: "Alert generated",
                timestamp: new Date().toISOString(),
                description: "Federal register exclusions list released."
              }
            ]
          };
          setAlerts(prev => [newAlert, ...prev]);
          setUnreadIds(prev => new Set([...prev, newAlert.id]));
          setDynamicRiskScore(prev => Math.min(100, (prev || result.riskScore) + 4));
        }
      }
    ];

    const timers = simulationTimeline.map(item => {
      return setTimeout(item.action, item.time);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [phase, activeAnalysisId, result]);

  return (
    <>
      <Header
        dataMode={result?.dataMode}
        unreadCount={unreadIds.size}
        onBellClick={result ? () => setAlertCenterOpen(true) : undefined}
      />
      <main className="flex-1 mx-auto w-full max-w-7xl px-5">
        {phase === "idle" && (
          <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center py-10">
            <IntakeChat onReady={run} presets={PRESETS} />
            <div className="mt-8">
              {manual ? (
                <div className="w-full max-w-2xl mx-auto">
                  <AnalyzeForm onSubmit={run} loading={false} />
                  <button onClick={() => setManual(false)} className="mt-3 block mx-auto text-[11px] mono text-muted hover:text-foreground transition">
                    ← back to assistant
                  </button>
                </div>
              ) : (
                <button onClick={() => setManual(true)} className="text-xs text-foreground/60 hover:text-foreground border-b border-foreground/20 hover:border-foreground/50 pb-0.5 transition">
                  or enter details manually
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "running" && (
          <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center py-10">
            <div className="w-full max-w-xl">
              {active && (
                <div className="text-center mb-6">
                  <div className="serif text-3xl">Analyzing your shipment</div>
                  <p className="text-sm text-muted mt-2">
                    {active.product} · {active.origin} → {active.destination}
                    {active.shippingMode ? ` · ${active.shippingMode}` : ""}
                  </p>
                </div>
              )}
              <AgentConsole agents={agents} logs={logs} />
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-5 py-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-semibold">Risk Analysis</h1>
                  {result && (
                    <span className="inline-flex items-center gap-1.5 text-[9px] mono px-2 py-0.5 rounded bg-panel-2 border border-border text-muted uppercase">
                      <span className={`size-1.5 rounded-full ${result.aiModelUsed?.includes("Fallback") ? "bg-warn" : "bg-ok"}`} />
                      {result.aiModelUsed || "Google Gemini"}
                    </span>
                  )}
                </div>
                {result && (
                  <p className="text-sm text-muted mt-0.5">
                    {result.input.product} · {result.input.origin} → {result.input.destination}
                  </p>
                )}
              </div>
              <button
                onClick={reset}
                className="text-sm px-3.5 py-2 rounded-lg border border-border bg-panel-2 hover:border-accent/40 transition"
              >
                New analysis
              </button>
            </div>
            {error && (
              <div className="rounded-xl border border-danger/40 bg-danger/10 text-danger px-4 py-3 text-sm">{error}</div>
            )}
            {result && (
              <Dashboard
                result={result}
                liveAlerts={alerts}
                onOpenAlertCenter={() => setAlertCenterOpen(true)}
                dynamicRiskScore={dynamicRiskScore ?? result.riskScore}
              />
            )}
          </div>
        )}
      </main>

      <AlertCenter
        isOpen={alertCenterOpen}
        onClose={() => setAlertCenterOpen(false)}
        alerts={alerts}
        unreadIds={unreadIds}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onResolveAlert={handleResolveAlert}
      />

      {showInfoPopup && (
        <div className="fixed top-16 right-5 z-40 max-w-sm rounded-xl border border-accent/30 bg-panel p-4 shadow-xl transition-all duration-300 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-accent/15 text-accent shrink-0 mt-0.5 flex items-center justify-center">
            <Bell className="size-4.5 animate-bounce" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <h4 className="text-xs font-semibold text-foreground">AI Predictive Alert Center Active</h4>
            <p className="text-[11px] text-muted leading-relaxed mt-1">
              Continuous monitoring is running. We will alert you immediately via the bell icon in the header if shipment risks shift.
            </p>
            <div className="mt-2.5 flex items-center gap-3">
              <button
                onClick={() => {
                  setAlertCenterOpen(true);
                  setShowInfoPopup(false);
                }}
                className="text-[10px] mono text-accent hover:underline font-semibold cursor-pointer"
              >
                Open Alert Center
              </button>
              <button
                onClick={() => setShowInfoPopup(false)}
                className="text-[10px] mono text-muted hover:text-foreground cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowInfoPopup(false)}
            className="text-muted hover:text-foreground p-0.5 hover:bg-panel-2 rounded cursor-pointer shrink-0"
            aria-label="Dismiss popup"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </>
  );
}

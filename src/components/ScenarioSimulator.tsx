"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  Coins,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Edit2,
  Check,
} from "lucide-react";
import type { AnalysisResult, PredictiveAlert } from "@/lib/types";
import { cn, fmtUsd, riskColor, riskLabel } from "@/lib/utils";

export interface Scenario {
  id: string;
  name: string;
  shippingMode: string;
  portName: string;
  shipDateOffset: string; // "0" | "2w" | "1m" | "2m"
  priority: "balanced" | "cost" | "speed";
  containerSize: string;
  riskTolerance: "low" | "medium" | "high";
}

export interface ScenarioSimulatorProps {
  result: AnalysisResult;
  scenarios: Scenario[];
  setScenarios: React.Dispatch<React.SetStateAction<Scenario[]>>;
  selectedInsightId: string;
  setSelectedInsightId: (id: string) => void;
}

const DEPARTURE_OFFSETS = [
  { value: "0", label: "As Scheduled" },
  { value: "2w", label: "Delay 2 Weeks" },
  { value: "1m", label: "Delay 1 Month" },
  { value: "2m", label: "Delay 2 Months" },
];

const CONTAINER_SIZES = ["20ft", "40ft", "40ft HC", "LCL", "Pallets", "Air ULD"];

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

export function ScenarioSimulator({
  result,
  scenarios,
  setScenarios,
  selectedInsightId,
  setSelectedInsightId,
}: ScenarioSimulatorProps) {
  const baseMode = result.input.shippingMode || "Ocean (container)";
  const basePort = result.portRecommendation?.recommended || "N/A";
  const baseContainer = result.input.containerSize || "40ft HC";
  const baseDate = result.input.shipDate || "August 2026";

  const getAlternativePorts = useCallback(() => {
    return result.portRecommendation?.options.map((o) => o.name) || [basePort];
  }, [result, basePort]);

  const getShippingModes = useCallback(() => {
    return result.routes.map((r) => r.method);
  }, [result]);

  const defaultScenarios = useCallback((): Scenario[] => {
    const alternativePorts = getAlternativePorts();
    const otherPort = alternativePorts.find((p) => p !== basePort) || alternativePorts[0] || basePort;
    const modes = getShippingModes();
    const airMode = modes.find((m) => m.toLowerCase().includes("air")) || "Air Freight";

    return [
      {
        id: "sim-1",
        name: "Express Air Route",
        shippingMode: airMode,
        portName: basePort,
        shipDateOffset: "0",
        priority: "speed",
        containerSize: "Pallets",
        riskTolerance: "medium",
      },
      {
        id: "sim-2",
        name: "Congestion Avoidance",
        shippingMode: baseMode,
        portName: otherPort,
        shipDateOffset: "1m",
        priority: "balanced",
        containerSize: baseContainer,
        riskTolerance: "low",
      },
    ];
  }, [baseMode, basePort, baseContainer, getAlternativePorts, getShippingModes]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Client-side simulator engine
  const simulate = useCallback(
    (s: Omit<Scenario, "id" | "name">) => {
      // Find matching route from baseline results
      const matchingRoute =
        result.routes.find((r) => r.method.toLowerCase().includes(s.shippingMode.toLowerCase())) ||
        result.routes[0];

      const portOptions = result.portRecommendation?.options || [];
      const selectedPortOpt =
        portOptions.find((p) => p.name === s.portName) ||
        portOptions.find((p) => p.recommended) ||
        portOptions[0];

      // 1. Calculate Cost
      let cost = matchingRoute?.cost || 3000;

      // Adjust port-specific cost differential if Ocean Freight
      if (s.shippingMode.toLowerCase().includes("ocean") && selectedPortOpt) {
        const baselineRecommendedPort = result.portRecommendation?.recommended || "";
        const basePortOpt = portOptions.find((p) => p.name === baselineRecommendedPort);
        if (basePortOpt) {
          const diff = selectedPortOpt.freightCost - basePortOpt.freightCost;
          cost += diff;
        }
      }

      // Adjust cost based on container size
      const getContainerMultiplier = (size: string) => {
        switch (size) {
          case "20ft":
            return 0.75;
          case "40ft":
            return 0.95;
          case "40ft HC":
            return 1.0;
          case "LCL":
            return 0.6;
          case "Pallets":
            return 0.5;
          case "Air ULD":
            return 1.1;
          default:
            return 1.0;
        }
      };

      const containerMult = getContainerMultiplier(s.containerSize) / getContainerMultiplier(baseContainer);
      cost = Math.round(cost * containerMult);

      // Cost Nudge based on priority focus
      if (s.priority === "speed") {
        cost = Math.round(cost * 1.05); // 5% speed booking/insurance premium
      } else if (s.priority === "cost") {
        cost = Math.round(cost * 0.97); // 3% discount for flexible scheduling
      }

      // 2. Calculate Transit Days & Expected Delay
      const baseTransit = matchingRoute?.transitDays || 20;
      let portWait = selectedPortOpt?.waitDays || 0;

      // If not Ocean mode, port congestion wait time drops significantly
      if (!s.shippingMode.toLowerCase().includes("ocean")) {
        portWait = Math.round(portWait * 0.1);
      }

      const [baseDelayLo, baseDelayHi] = result.expectedDelayDays;
      let delayLo = baseDelayLo;
      let delayHi = baseDelayHi;

      // Shifting date to avoid peak weather
      let weatherNudge = 0;
      if (s.shipDateOffset === "1m" || s.shipDateOffset === "2m") {
        const baselineMonth = baseDate.toLowerCase();
        if (
          baselineMonth.includes("august") ||
          baselineMonth.includes("september") ||
          baselineMonth.includes("aug") ||
          baselineMonth.includes("sep")
        ) {
          weatherNudge = -4; // reduce delay lo/hi by 4 days due to leaving typhoon season
        }
      }

      // Calculate final delay range
      const baseRecPortWait = result.portRecommendation?.options.find((p) => p.recommended)?.waitDays || 0;
      const waitDiff = portWait - baseRecPortWait;
      delayLo = Math.max(0, Math.round(delayLo + waitDiff + weatherNudge * 0.7));
      delayHi = Math.max(delayLo + 1, Math.round(delayHi + waitDiff + weatherNudge));

      const totalTransitLo = baseTransit + delayLo;
      const totalTransitHi = baseTransit + delayHi;

      // 3. Calculate Risk Score
      let riskScore = result.riskScore;

      // If Air mode, risk score drops
      if (s.shippingMode.toLowerCase().includes("air")) {
        riskScore -= 18;
      } else if (s.shippingMode.toLowerCase().includes("rail")) {
        riskScore -= 8;
      }

      // Port Congestion effect on Risk Score
      if (s.shippingMode.toLowerCase().includes("ocean") && selectedPortOpt) {
        const recommendedPort = portOptions.find((p) => p.recommended);
        const recCongestion = recommendedPort?.congestionScore || 50;
        const selectedCongestion = selectedPortOpt.congestionScore;
        const diff = selectedCongestion - recCongestion;
        riskScore += Math.round(diff * 0.15);
      }

      // Ship Date effect on Risk Score
      if (s.shipDateOffset !== "0") {
        const baselineMonth = baseDate.toLowerCase();
        if (
          baselineMonth.includes("august") ||
          baselineMonth.includes("september") ||
          baselineMonth.includes("aug") ||
          baselineMonth.includes("sep")
        ) {
          if (s.shipDateOffset === "2w") riskScore -= 4;
          else if (s.shipDateOffset === "1m") riskScore -= 10;
          else if (s.shipDateOffset === "2m") riskScore -= 14;
        }
      }

      // Priority focus adjustments
      if (s.riskTolerance === "low") {
        // low risk preference can reflect in tighter recommendations
      }

      riskScore = Math.max(10, Math.min(100, riskScore));

      return {
        cost,
        transitLo: totalTransitLo,
        transitHi: totalTransitHi,
        delayLo,
        delayHi,
        riskScore,
        selectedPortName: selectedPortOpt?.name || s.portName,
      };
    },
    [result, baseContainer, baseDate]
  );

  // Compile simulated results for all custom scenarios
  const simulatedData = scenarios.reduce((acc, s) => {
    acc[s.id] = simulate(s);
    return acc;
  }, {} as Record<string, ReturnType<typeof simulate>>);

  // Score comparison stats relative to baseline
  const getComparisonStats = (id: string, sim: ReturnType<typeof simulate>) => {
    const baseCost = (result.routes.find((r) => r.recommended) || result.routes[0])?.cost || 3000;
    const baseDelay = (result.expectedDelayDays[0] + result.expectedDelayDays[1]) / 2;
    const baseRisk = result.riskScore;

    const costDiff = sim.cost - baseCost;
    const simDelay = (sim.delayLo + sim.delayHi) / 2;
    const delayDiff = simDelay - baseDelay;
    const riskDiff = sim.riskScore - baseRisk;

    return {
      costDiff,
      delayDiff,
      riskDiff,
    };
  };

  // Generate Trade-off Insights
  const generateInsights = (s: Scenario, sim: ReturnType<typeof simulate>) => {
    const stats = getComparisonStats(s.id, sim);
    const baseCost = (result.routes.find((r) => r.recommended) || result.routes[0])?.cost || 3000;

    const changes = [];
    const baseModeShort = baseMode.toLowerCase().split(" ")[0];
    const modeLabelShort = s.shippingMode.toLowerCase().split(" ")[0];
    if (baseModeShort !== modeLabelShort) {
      changes.push(`transportation mode to ${s.shippingMode}`);
    }
    if (s.portName && basePort && s.portName !== basePort) {
      changes.push(`destination port to ${s.portName}`);
    }
    if (s.shipDateOffset !== "0") {
      const offsetLabels = { "2w": "by 2 weeks", "1m": "by 1 month", "2m": "by 2 months" };
      changes.push(`departure date ${offsetLabels[s.shipDateOffset as keyof typeof offsetLabels]}`);
    }
    if (s.containerSize !== baseContainer) {
      changes.push(`container size to ${s.containerSize}`);
    }
    if (s.priority !== "balanced") {
      changes.push(`operational priority to ${s.priority} focus`);
    }

    const whatChanged =
      changes.length > 0
        ? `You shifted the ${changes.slice(0, -1).join(", ") + (changes.length > 1 ? " and " : "") + changes.slice(-1)}.`
        : "No parameter changes made compared to the baseline shipment.";

    const riskReasons = [];
    if (s.shippingMode.toLowerCase().includes("air")) {
      riskReasons.push("air transit completely bypasses sea lanes, ocean storm regions, and marine terminal bottleneck congestion");
    }
    const portOptions = result.portRecommendation?.options || [];
    const opt = portOptions.find((p) => p.name === s.portName);
    const baseOpt = portOptions.find((p) => p.name === basePort);
    if (opt && baseOpt && opt.congestionScore < baseOpt.congestionScore) {
      riskReasons.push(`routing via ${s.portName} avoids the elevated wait times at ${basePort} (${opt.congestionScore} vs ${baseOpt.congestionScore} congestion score)`);
    } else if (opt && baseOpt && opt.congestionScore > baseOpt.congestionScore) {
      riskReasons.push(`routing via ${s.portName} increases congestion exposure by +${opt.congestionScore - baseOpt.congestionScore} points`);
    }
    if (s.shipDateOffset !== "0") {
      riskReasons.push("shifting dispatch date mitigates exposure to peak seasonal typhoon windows");
    }

    let whyRiskChanged = "";
    if (stats.riskDiff < -10) {
      whyRiskChanged = `The global risk score decreases by ${Math.abs(stats.riskDiff)} points because ${riskReasons.join(" and ")}.`;
    } else if (stats.riskDiff > 5) {
      whyRiskChanged = `The global risk score increases by ${stats.riskDiff} points because ${riskReasons.join(" and ")}.`;
    } else {
      whyRiskChanged =
        riskReasons.length > 0
          ? `Landed risk remains relatively stable (${stats.riskDiff > 0 ? "+" : ""}${stats.riskDiff} points), as ${riskReasons.join(" while ")}.`
          : "Landed risk remains identical to baseline as the cargo lanes and schedule align.";

    }

    let betterOrWorse = "";
    let tradeOffs = "";

    if (stats.costDiff > 0 && stats.delayDiff < 0) {
      betterOrWorse = `This alternative cuts expected transit delay by ${Math.abs(stats.delayDiff).toFixed(1)} days, but incurs a premium of ${fmtUsd(stats.costDiff)} in freight spend.`;
      tradeOffs = `Accelerated lead-time reliability vs. a +${Math.round((stats.costDiff / baseCost) * 100)}% budget increase.`;
    } else if (stats.costDiff < 0 && stats.delayDiff > 0) {
      betterOrWorse = `This alternative saves ${fmtUsd(Math.abs(stats.costDiff))} in shipping fees, but adds an estimated delay of ${stats.delayDiff.toFixed(1)} days to delivery timelines.`;
      tradeOffs = `Landed cost savings of -${Math.round((Math.abs(stats.costDiff) / baseCost) * 100)}% vs. increased exposure to port demurrage and inventory stockouts.`;
    } else if (stats.costDiff < 0 && stats.delayDiff <= 0) {
      betterOrWorse = `This is a highly optimized configuration, providing cost savings of ${fmtUsd(Math.abs(stats.costDiff))} while maintaining or shortening transit times.`;
      tradeOffs = "Operational synergy: cost savings combined with improved lead-time predictability.";
    } else if (stats.costDiff > 0 && stats.delayDiff >= 0) {
      betterOrWorse = `This option is sub-optimal: it increases shipping spend by ${fmtUsd(stats.costDiff)} without providing transit speedups (+${stats.delayDiff.toFixed(1)} days delay).`;
      tradeOffs = "Financial penalty without operational or risk mitigation benefits.";
    } else {
      betterOrWorse = "This scenario is operationally identical, showing marginal cost and risk adjustments compared to the baseline shipment.";
      tradeOffs = "Neutral operational swap.";
    }

    return {
      whatChanged,
      whyRiskChanged,
      betterOrWorse,
      tradeOffs,
    };
  };

  // Get Best Scenario recommendation
  const getBestScenario = () => {
    const baseCost = (result.routes.find((r) => r.recommended) || result.routes[0])?.cost || 3000;
    const baseDelay = (result.expectedDelayDays[0] + result.expectedDelayDays[1]) / 2;
    const baseRisk = result.riskScore;

    let bestId = "baseline";
    let bestName = "Baseline (Original Shipment)";
    let bestExplanation = `The baseline ${baseMode} shipment offers the most competitive base landed cost of ${fmtUsd(baseCost)}, but remains exposed to elevated congestion and delays (+${result.expectedDelayDays[0]}–${result.expectedDelayDays[1]}d) at ${basePort}. If your delivery dates are flexible, the baseline represents the best budgetary selection.`;
    let highestScore = -(baseRisk * 1.5 + baseDelay * 40 + baseCost * 0.08);

    scenarios.forEach((s) => {
      const sim = simulatedData[s.id];
      if (!sim) return;

      const simDelay = (sim.delayLo + sim.delayHi) / 2;
      let wRisk = 2.0;
      let wDelay = 50;
      let wCost = 0.1;

      if (s.priority === "speed") {
        wRisk = 1.0;
        wDelay = 120;
        wCost = 0.02;
      } else if (s.priority === "cost") {
        wRisk = 1.5;
        wDelay = 15;
        wCost = 0.3;
      }

      const score = -(sim.riskScore * wRisk + simDelay * wDelay + sim.cost * wCost);
      if (score > highestScore) {
        highestScore = score;
        bestId = s.id;
        bestName = s.name;

        const costDiff = sim.cost - baseCost;
        const delayDiff = simDelay - baseDelay;

        if (s.shippingMode.toLowerCase().includes("air")) {
          bestExplanation = `"${s.name}" is recommended for priority shipments. By switching to Air Freight, you completely bypass the LA port congestion and ocean weather disruptions, reducing expected delay variance by ~${Math.abs(delayDiff).toFixed(0)} days. This is optimal if avoiding inventory shortages justifies the ${fmtUsd(costDiff)} premium.`;
        } else if (s.portName && s.portName !== basePort) {
          bestExplanation = `"${s.name}" is recommended as the optimal cost-benefit choice. Rerouting from the congested ${basePort} to ${s.portName} avoids significant port dwells, saving ~${Math.abs(delayDiff).toFixed(1)} days of delay. The cost increase is minor (+${fmtUsd(costDiff)}), providing the best risk-adjusted cost-to-speed balance.`;
        } else if (s.shipDateOffset !== "0") {
          bestExplanation = `"${s.name}" is recommended. Delaying the departure date by ${s.shipDateOffset === "2w" ? "2 weeks" : s.shipDateOffset === "1m" ? "1 month" : "2 months"} shifts the cargo out of peak weather storm windows. This decreases weather risk by ${Math.abs(sim.riskScore - baseRisk)} points and reduces delay by ${Math.abs(delayDiff).toFixed(1)} days while preserving the baseline transport budget.`;
        } else {
          bestExplanation = `"${s.name}" is recommended as it offers optimized parameters. It mitigates transit risk to ${sim.riskScore}/100 and reduces expected delay by ${Math.abs(delayDiff).toFixed(1)} days, balancing speed gains against a minor budget delta.`;
        }
      }
    });

    return {
      bestId,
      bestName,
      bestExplanation,
    };
  };

  const bestRec = getBestScenario();

  // Scenario Management Actions
  const handleCreateScenario = () => {
    const newId = `sim-${Date.now()}`;
    const nextNum = scenarios.length + 1;
    const newScenario: Scenario = {
      id: newId,
      name: `Scenario ${nextNum}`,
      shippingMode: baseMode,
      portName: basePort,
      shipDateOffset: "0",
      priority: "balanced",
      containerSize: baseContainer,
      riskTolerance: "medium",
    };
    setScenarios((prev) => [...prev, newScenario]);
    setSelectedInsightId(newId);
  };

  const handleDuplicateScenario = (id: string) => {
    const target = scenarios.find((s) => s.id === id);
    if (!target) return;

    const newId = `sim-${Date.now()}`;
    const newScenario: Scenario = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`,
    };
    setScenarios((prev) => [...prev, newScenario]);
    setSelectedInsightId(newId);
  };

  const handleDeleteScenario = (id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    if (selectedInsightId === id) {
      setSelectedInsightId("baseline");
    }
  };

  const handleUpdateScenario = (id: string, patch: Partial<Omit<Scenario, "id">>) => {
    setScenarios((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return { ...s, ...patch };
        }
        return s;
      })
    );
  };

  const handleRenameScenarioStart = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleRenameScenarioComplete = (id: string) => {
    if (editingName.trim()) {
      setScenarios((prev) =>
        prev.map((s) => (s.id === id ? { ...s, name: editingName.trim() } : s))
      );
      if (selectedInsightId === id) {
        // keep selected
      }
    }
    setEditingId(null);
  };

  const handleResetScenarios = () => {
    setScenarios(defaultScenarios());
    setSelectedInsightId("baseline");
  };

  // Get selected scenario details for Insight Panel
  const getSelectedInsightDetails = () => {
    if (selectedInsightId === "baseline") {
      const baseCost = (result.routes.find((r) => r.recommended) || result.routes[0])?.cost || 3000;
      const baseDelay = (result.expectedDelayDays[0] + result.expectedDelayDays[1]) / 2;
      return {
        name: "Baseline (Original Shipment)",
        whatChanged: "This is your original analysis baseline.",
        whyRiskChanged: `Baseline risk score is ${result.riskScore}/100. Port congestion at ${basePort} and weather factors are monitored.`,
        betterOrWorse: `Landed cost is locked/estimated at ${fmtUsd(baseCost)} with average risk delays of ${baseDelay.toFixed(1)} days.`,
        tradeOffs: "Standard logistics settings for this product category and lane.",
      };
    }

    const s = scenarios.find((x) => x.id === selectedInsightId);
    const sim = simulatedData[selectedInsightId];
    if (!s || !sim) return null;

    return {
      name: s.name,
      ...generateInsights(s, sim),
    };
  };

  const selectedInsight = getSelectedInsightDetails();

  return (
    <section className="rounded-2xl border border-border bg-panel/70 p-5 mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-border/60 pb-4">
        <div>
          <h3 className="text-[11px] mono uppercase tracking-wider text-muted">What-If Scenario Simulator</h3>
          <h2 className="text-lg font-semibold text-foreground mt-0.5">Explore Logistic Alternatives</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetScenarios}
            className="text-[11px] mono inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-panel-2 text-muted hover:text-foreground hover:border-accent/40 transition cursor-pointer"
          >
            <RotateCcw className="size-3.5" /> Reset Simulator
          </button>
          <button
            onClick={handleCreateScenario}
            className="text-[11px] mono inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition cursor-pointer"
          >
            <Plus className="size-3.5" /> New Scenario
          </button>
        </div>
      </div>

      {/* Side-by-side comparison table/grid */}
      <div className="overflow-x-auto -mx-5 px-5 pb-4">
        <div className="flex gap-4 min-w-[850px]">
          {/* BASELINE CARD */}
          <div className="w-[280px] rounded-xl border border-border bg-panel-2/30 p-4 shrink-0 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                <span className="text-[11px] mono font-bold text-muted uppercase">Baseline</span>
                <span className="text-[9px] mono px-1.5 py-0.5 rounded bg-panel-2 border border-border text-muted">ORIGINAL</span>
              </div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Original Shipment</h4>

              {/* Baseline params */}
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="block text-[10px] mono text-muted uppercase tracking-wide mb-1">Mode</span>
                  <div className="px-2.5 py-1.5 rounded border border-border/50 bg-panel-2/40 text-foreground truncate font-medium">
                    {baseMode}
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] mono text-muted uppercase tracking-wide mb-1">Destination Port</span>
                  <div className="px-2.5 py-1.5 rounded border border-border/50 bg-panel-2/40 text-foreground truncate font-medium">
                    {basePort}
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] mono text-muted uppercase tracking-wide mb-1">Ship Date</span>
                  <div className="px-2.5 py-1.5 rounded border border-border/50 bg-panel-2/40 text-foreground truncate font-medium">
                    {baseDate} (Scheduled)
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] mono text-muted uppercase tracking-wide mb-1">Container Size</span>
                  <div className="px-2.5 py-1.5 rounded border border-border/50 bg-panel-2/40 text-foreground truncate font-medium">
                    {baseContainer}
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] mono text-muted uppercase tracking-wide mb-1">Priority Focus</span>
                  <div className="px-2.5 py-1.5 rounded border border-border/50 bg-panel-2/40 text-foreground truncate font-medium capitalize">
                    Balanced
                  </div>
                </div>
              </div>
            </div>

            {/* Baseline calculated values */}
            <div className="mt-6 pt-4 border-t border-border/50 space-y-3 text-xs bg-panel-2/20 -mx-4 -mb-4 p-4 rounded-b-xl">
              <div className="flex items-center justify-between">
                <span className="text-muted">Global Risk Score</span>
                <span
                  className="mono text-xs font-bold px-1.5 py-0.5 rounded"
                  style={{
                    color: riskColor(result.riskScore),
                    background: `color-mix(in srgb, ${riskColor(result.riskScore)} 14%, transparent)`,
                  }}
                >
                  {result.riskScore} ({riskLabel(result.riskScore)})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Estimated Cost</span>
                <span className="font-semibold text-foreground mono">
                  {fmtUsd((result.routes.find((r) => r.recommended) || result.routes[0])?.cost || 3000)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Expected Delay</span>
                <span className="font-semibold text-warn mono">
                  +{result.expectedDelayDays[0]}–{result.expectedDelayDays[1]}d
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Total Transit</span>
                <span className="font-semibold text-foreground mono">
                  {((result.routes.find((r) => r.recommended) || result.routes[0])?.transitDays || 22) +
                    result.expectedDelayDays[0]}
                  –
                  {((result.routes.find((r) => r.recommended) || result.routes[0])?.transitDays || 22) +
                    result.expectedDelayDays[1]}
                  d
                </span>
              </div>
              <button
                onClick={() => setSelectedInsightId("baseline")}
                className={cn(
                  "w-full text-center text-[10px] mono py-1.5 rounded border transition cursor-pointer mt-2",
                  selectedInsightId === "baseline"
                    ? "border-accent bg-accent/10 text-accent font-semibold"
                    : "border-border text-muted hover:text-foreground"
                )}
              >
                {selectedInsightId === "baseline" ? "✓ Selected for Insights" : "Select for Insights"}
              </button>
            </div>
          </div>

          {/* DYNAMIC SCENARIO CARDS */}
          {scenarios.map((s) => {
            const sim = simulatedData[s.id];
            if (!sim) return null;

            const stats = getComparisonStats(s.id, sim);
            const isEditing = editingId === s.id;
            const alternativePorts = getAlternativePorts();
            const modes = getShippingModes();

            return (
              <div
                key={s.id}
                className={cn(
                  "w-[280px] rounded-xl border p-4 shrink-0 flex flex-col justify-between transition-all duration-200",
                  bestRec.bestId === s.id
                    ? "border-accent bg-accent/3 shadow-xs"
                    : "border-border bg-panel/40"
                )}
              >
                <div>
                  {/* Scenario Header with actions */}
                  <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2">
                    <span className="text-[11px] mono font-bold text-muted uppercase">Alternative</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDuplicateScenario(s.id)}
                        className="p-1 rounded hover:bg-panel-2 text-muted hover:text-foreground transition cursor-pointer"
                        title="Duplicate scenario"
                      >
                        <Copy className="size-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteScenario(s.id)}
                        className="p-1 rounded hover:bg-panel-2 text-muted text-danger/80 hover:text-danger transition cursor-pointer"
                        title="Delete scenario"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>

                  {/* Scenario Name Rename Box */}
                  <div className="mb-4">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          className="w-full bg-panel-2 border border-accent rounded px-2 py-1 text-xs font-semibold text-foreground outline-none focus:ring-1 focus:ring-accent/30"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleRenameScenarioComplete(s.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameScenarioComplete(s.id);
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameScenarioComplete(s.id)}
                          className="p-1.5 bg-accent text-white rounded cursor-pointer"
                        >
                          <Check className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between group">
                        <h4 className="text-sm font-semibold text-foreground truncate max-w-[210px]">
                          {s.name}
                        </h4>
                        <button
                          onClick={() => handleRenameScenarioStart(s.id, s.name)}
                          className="p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-foreground transition cursor-pointer"
                          title="Rename scenario"
                        >
                          <Edit2 className="size-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Editable Fields */}
                  <div className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-[10px] mono text-muted uppercase tracking-wide mb-1">
                        Mode
                      </label>
                      <select
                        className="w-full rounded-md bg-panel-2 border border-border px-2.5 py-1.5 text-xs outline-none focus:border-accent/60 transition font-medium"
                        value={s.shippingMode}
                        onChange={(e) => handleUpdateScenario(s.id, { shippingMode: e.target.value })}
                      >
                        {modes.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] mono text-muted uppercase tracking-wide mb-1">
                        Destination Port
                      </label>
                      <select
                        className="w-full rounded-md bg-panel-2 border border-border px-2.5 py-1.5 text-xs outline-none focus:border-accent/60 transition font-medium"
                        value={s.portName}
                        onChange={(e) => handleUpdateScenario(s.id, { portName: e.target.value })}
                        disabled={!s.shippingMode.toLowerCase().includes("ocean")}
                      >
                        {alternativePorts.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                        {!s.shippingMode.toLowerCase().includes("ocean") && (
                          <option value="N/A">Airport Hub (By-pass Port)</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] mono text-muted uppercase tracking-wide mb-1">
                        Departure Date
                      </label>
                      <select
                        className="w-full rounded-md bg-panel-2 border border-border px-2.5 py-1.5 text-xs outline-none focus:border-accent/60 transition font-medium"
                        value={s.shipDateOffset}
                        onChange={(e) => handleUpdateScenario(s.id, { shipDateOffset: e.target.value })}
                      >
                        {DEPARTURE_OFFSETS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] mono text-muted uppercase tracking-wide mb-1">
                        Container Size
                      </label>
                      <select
                        className="w-full rounded-md bg-panel-2 border border-border px-2.5 py-1.5 text-xs outline-none focus:border-accent/60 transition font-medium"
                        value={s.containerSize}
                        onChange={(e) => handleUpdateScenario(s.id, { containerSize: e.target.value })}
                      >
                        {CONTAINER_SIZES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] mono text-muted uppercase tracking-wide mb-1">
                        Priority Focus
                      </label>
                      <select
                        className="w-full rounded-md bg-panel-2 border border-border px-2.5 py-1.5 text-xs outline-none focus:border-accent/60 transition font-medium"
                        value={s.priority}
                        onChange={(e) =>
                          handleUpdateScenario(s.id, { priority: e.target.value as any })
                        }
                      >
                        <option value="balanced">Balanced</option>
                        <option value="cost">Cost Focus</option>
                        <option value="speed">Speed Focus</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Simulated Results Section */}
                <div className="mt-6 pt-4 border-t border-border/50 space-y-3 text-xs bg-panel-2/10 -mx-4 -mb-4 p-4 rounded-b-xl">
                  {/* Risk Score */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Global Risk Score</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="mono text-xs font-bold px-1.5 py-0.5 rounded"
                        style={{
                          color: riskColor(sim.riskScore),
                          background: `color-mix(in srgb, ${riskColor(sim.riskScore)} 14%, transparent)`,
                        }}
                      >
                        {sim.riskScore}
                      </span>
                      {stats.riskDiff !== 0 && (
                        <span
                          className={cn(
                            "text-[10px] mono font-semibold",
                            stats.riskDiff < 0 ? "text-ok" : "text-danger"
                          )}
                        >
                          {stats.riskDiff < 0 ? "↓" : "↑"}
                          {Math.abs(stats.riskDiff)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cost */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Estimated Cost</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground mono">{fmtUsd(sim.cost)}</span>
                      {stats.costDiff !== 0 && (
                        <span
                          className={cn(
                            "text-[10px] mono font-semibold",
                            stats.costDiff < 0 ? "text-ok" : "text-danger"
                          )}
                        >
                          {stats.costDiff < 0 ? "-" : "+"}
                          {fmtUsd(Math.abs(stats.costDiff))}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delay */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Expected Delay</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-warn mono">
                        +{sim.delayLo}–{sim.delayHi}d
                      </span>
                      {stats.delayDiff !== 0 && (
                        <span
                          className={cn(
                            "text-[10px] mono font-semibold",
                            stats.delayDiff < 0 ? "text-ok" : "text-danger"
                          )}
                        >
                          {stats.delayDiff < 0 ? "↓" : "↑"}
                          {Math.abs(stats.delayDiff).toFixed(1)}d
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Transit */}
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Total Transit</span>
                    <span className="font-semibold text-foreground mono">
                      {sim.transitLo}–{sim.transitHi}d
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedInsightId(s.id)}
                    className={cn(
                      "w-full text-center text-[10px] mono py-1.5 rounded border transition cursor-pointer mt-2",
                      selectedInsightId === s.id
                        ? "border-accent bg-accent/10 text-accent font-semibold"
                        : "border-border text-muted hover:text-foreground"
                    )}
                  >
                    {selectedInsightId === s.id ? "✓ Selected for Insights" : "Select for Insights"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Decision Insights panel + Best Scenario Recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
        {/* Scenario Recommendation */}
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-accent font-semibold text-sm mb-3">
              <Sparkles className="size-4.5" />
              <span>Route Pilote Best Choice</span>
            </div>
            <div className="mb-2">
              <span className="text-[10px] mono uppercase text-muted">Recommended Scenario</span>
              <h4 className="text-base font-bold text-foreground leading-tight mt-0.5">{bestRec.bestName}</h4>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed mb-4">{bestRec.bestExplanation}</p>
          </div>
          <div className="text-[10px] mono text-accent">
            *Optimized based on active risk scores, demurrage thresholds, and priority constraints.
          </div>
        </div>

        {/* Dynamic Insights Panel */}
        {selectedInsight && (
          <div className="lg:col-span-2 rounded-xl border border-border bg-panel-2/30 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
              <div className="flex items-center gap-1.5 text-foreground font-semibold text-sm">
                <Coins className="size-4 text-muted" />
                <span>AI Trade-Off Analysis: {selectedInsight.name}</span>
              </div>
              <span className="text-[9px] mono px-2 py-0.5 rounded bg-panel text-muted uppercase">
                Insights Panel
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-semibold text-[10px] mono uppercase text-muted tracking-wider block mb-1">
                  What Adjusted?
                </span>
                <p className="text-foreground/90 leading-relaxed bg-panel border border-border/40 rounded-lg p-2.5">
                  {selectedInsight.whatChanged}
                </p>
              </div>

              <div>
                <span className="font-semibold text-[10px] mono uppercase text-muted tracking-wider block mb-1">
                  Risk Assessment Impact
                </span>
                <p className="text-foreground/90 leading-relaxed bg-panel border border-border/40 rounded-lg p-2.5">
                  {selectedInsight.whyRiskChanged}
                </p>
              </div>

              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
                <div>
                  <span className="font-semibold text-[10px] mono uppercase text-muted tracking-wider block mb-1">
                    Landed cost & transit summary
                  </span>
                  <p className="text-foreground/90 leading-relaxed">{selectedInsight.betterOrWorse}</p>
                </div>

                <div>
                  <span className="font-semibold text-[10px] mono uppercase text-accent tracking-wider block mb-1">
                    Key Trade-off Breakdown
                  </span>
                  <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 flex items-start gap-2">
                    <TrendingUp className="size-4 text-accent shrink-0 mt-0.5" />
                    <p className="text-foreground font-medium leading-relaxed">{selectedInsight.tradeOffs}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import {
  Ship,
  Anchor,
  CloudRain,
  ShieldAlert,
  Scale,
  Factory,
  Coins,
  Globe,
  X,
  Check,
  TrendingUp,
  AlertTriangle,
  Clock,
} from "lucide-react";
import type { PredictiveAlert } from "@/lib/types";
import { cn } from "@/lib/utils";

// Category Icons mapping
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  freight: <Ship className="size-3.5" />,
  port: <Anchor className="size-3.5" />,
  weather: <CloudRain className="size-3.5" />,
  commodity: <Coins className="size-3.5" />,
  supplier: <Factory className="size-3.5" />,
  regulatory: <ShieldAlert className="size-3.5" />,
  tariff: <Scale className="size-3.5" />,
  geopolitical: <Globe className="size-3.5" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  freight: "Freight",
  port: "Port",
  weather: "Weather",
  commodity: "Commodity",
  supplier: "Supplier",
  regulatory: "Regulatory",
  tariff: "Tariff",
  geopolitical: "Geopolitical",
};

// Severity badge styling
const SEVERITY_STYLES: Record<string, { badge: string; text: string; dot: string }> = {
  critical: {
    badge: "border-danger/30 text-danger bg-danger/10",
    text: "text-danger",
    dot: "bg-danger",
  },
  high: {
    badge: "border-warn/30 text-warn bg-warn/10",
    text: "text-warn",
    dot: "bg-warn",
  },
  medium: {
    badge: "border-accent-2/30 text-accent-2 bg-accent-2/10",
    text: "text-accent-2",
    dot: "bg-accent-2",
  },
  low: {
    badge: "border-border text-muted bg-panel-2",
    text: "text-muted",
    dot: "bg-muted",
  },
};

interface AlertCenterProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: PredictiveAlert[];
  unreadIds: Set<string>;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onResolveAlert: (id: string) => void;
}

export function AlertCenter({
  isOpen,
  onClose,
  alerts,
  unreadIds,
  onMarkRead,
  onMarkAllRead,
  onResolveAlert,
}: AlertCenterProps) {
  const [activeTab, setActiveTab] = useState<"active" | "all" | "resolved">("active");
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  // Filter alerts based on active tab
  const filteredAlerts = alerts.filter((a) => {
    if (activeTab === "active") return a.status === "active";
    if (activeTab === "resolved") return a.status === "resolved";
    return true; // "all"
  });

  const activeCount = alerts.filter((a) => a.status === "active").length;
  const resolvedCount = alerts.filter((a) => a.status === "resolved").length;
  const unreadCount = unreadIds.size;

  const toggleExpand = (id: string) => {
    setExpandedAlertId((prev) => (prev === id ? null : id));
    if (unreadIds.has(id)) {
      onMarkRead(id);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full max-w-lg border-l border-border bg-panel shadow-2xl transition-transform duration-300 ease-out flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <span className="p-2 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                <AlertTriangle className="size-4.5" />
              </span>
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white shadow-sm">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight text-foreground">AI Predictive Alert Center</h2>
              <p className="text-[11px] mono text-muted mt-0.5 uppercase tracking-wider">Continuous Risk Monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-border bg-panel hover:bg-panel-2 text-muted hover:text-foreground transition cursor-pointer"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-panel-2/60 transition cursor-pointer"
              aria-label="Close panel"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-5 py-2.5 border-b border-border bg-panel-2/30 flex items-center gap-1.5 text-xs shrink-0">
          <button
            onClick={() => setActiveTab("active")}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5",
              activeTab === "active"
                ? "bg-panel border border-border text-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            )}
          >
            Active Alerts
            <span className={cn("px-1.5 py-0.2 rounded-full text-[9px] font-bold mono", 
              activeTab === "active" ? "bg-accent/15 text-accent" : "bg-border text-muted"
            )}>
              {activeCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5",
              activeTab === "all"
                ? "bg-panel border border-border text-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            )}
          >
            Alert History
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold mono bg-border text-muted">
              {alerts.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("resolved")}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5",
              activeTab === "resolved"
                ? "bg-panel border border-border text-foreground shadow-xs"
                : "text-muted hover:text-foreground"
            )}
          >
            Resolved
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold mono bg-border text-muted">
              {resolvedCount}
            </span>
          </button>
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-panel-2/20">
              <Clock className="size-8 mx-auto text-muted/60 mb-2.5" />
              <div className="text-sm font-medium text-foreground">No alerts found</div>
              <p className="text-xs text-muted mt-1 max-w-[280px] mx-auto leading-normal">
                {activeTab === "active"
                  ? "Continuous monitoring is running. We'll alert you if shipment risks shift."
                  : activeTab === "resolved"
                  ? "No resolved alerts yet. Active issues will show here once closed."
                  : "No alerts have been recorded for this shipment."}
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const isExpanded = expandedAlertId === alert.id;
              const isUnread = unreadIds.has(alert.id);
              const sev = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.low;
              const catIcon = CATEGORY_ICONS[alert.category] || <AlertTriangle className="size-3.5" />;
              const catLabel = CATEGORY_LABELS[alert.category] || alert.category;

              return (
                <div
                  key={alert.id}
                  className={cn(
                    "rounded-xl border transition-all duration-200 overflow-hidden text-left flex flex-col",
                    isExpanded
                      ? "border-accent bg-panel-2/15 shadow-sm"
                      : "border-border bg-panel-2/30 hover:border-border-hover hover:bg-panel-2/50",
                    isUnread && "border-accent-2/40 bg-accent-2/5"
                  )}
                >
                  {/* Alert Card Header summary (click to expand) */}
                  <button
                    onClick={() => toggleExpand(alert.id)}
                    className="p-4 w-full text-left flex items-start justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border border-border bg-panel text-muted font-medium capitalize">
                          {catIcon} {catLabel}
                        </span>
                        <span className={cn("text-[10px] uppercase font-bold mono px-2 py-0.5 rounded-full border tracking-wide", sev.badge)}>
                          {alert.severity}
                        </span>
                        {alert.status === "resolved" && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold mono px-2 py-0.5 rounded-full border border-ok/30 text-ok bg-ok/10">
                            ✓ Resolved
                          </span>
                        )}
                        {isUnread && (
                          <span className="size-2 rounded-full bg-accent-2 animate-pulse" title="Unread Alert" />
                        )}
                      </div>
                      <h3 className={cn(
                        "text-sm font-semibold leading-snug text-foreground",
                        alert.status === "resolved" && "text-foreground/75"
                      )}>
                        {alert.title}
                      </h3>
                      <p className="text-[12px] text-muted line-clamp-2 mt-1 leading-normal">
                        {alert.explanation}
                      </p>
                      <div className="text-[10px] mono text-muted mt-2">
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(alert.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </button>

                  {/* Expandable Panel */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border/50 bg-panel/30 space-y-4 text-xs">
                      {/* Why it was generated */}
                      <div>
                        <div className="font-semibold text-[10px] mono uppercase text-muted tracking-wider mb-1">
                          Why was this generated?
                        </div>
                        <p className="text-foreground/90 leading-relaxed bg-panel-2/40 border border-border/50 rounded-lg p-2.5">
                          {alert.why}
                        </p>
                      </div>

                      {/* Business Impact */}
                      {alert.businessImpact && (
                        <div>
                          <div className="font-semibold text-[10px] mono uppercase text-muted tracking-wider mb-1">
                            Expected Business Impact
                          </div>
                          <p className="text-foreground/90 leading-relaxed">
                            {alert.businessImpact}
                          </p>
                        </div>
                      )}

                      {/* AI Recommendation */}
                      <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 flex items-start gap-2.5">
                        <TrendingUp className="size-4 text-accent shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-[10px] mono uppercase text-accent tracking-wider mb-0.5">
                            AI Recommendation
                          </div>
                          <p className="text-foreground font-medium leading-relaxed">
                            {alert.recommendation}
                          </p>
                        </div>
                      </div>

                      {/* Confidence Level */}
                      <div className="flex items-center justify-between py-1.5 border-y border-border/40">
                        <span className="text-muted">AI Confidence Level</span>
                        <span className="font-semibold text-foreground mono text-right">{alert.confidence}%</span>
                      </div>

                      {/* Timeline */}
                      <div>
                        <div className="font-semibold text-[10px] mono uppercase text-muted tracking-wider mb-2">
                          Alert Evolution Timeline
                        </div>
                        <div className="relative pl-4 border-l border-border/60 ml-2 space-y-3">
                          {alert.timeline.map((evt, idx) => (
                            <div key={idx} className="relative">
                              <span className="absolute -left-[21px] top-0.5 size-2.5 rounded-full border border-border bg-panel flex items-center justify-center">
                                <span className={cn("size-1.5 rounded-full", alert.status === "resolved" && idx === alert.timeline.length - 1 ? "bg-ok" : "bg-muted")} />
                              </span>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-foreground text-[11px]">{evt.event}</span>
                                <span className="text-[10px] mono text-muted">
                                  {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted mt-0.5">{evt.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action buttons inside detail */}
                      <div className="pt-2 flex gap-2">
                        {alert.status === "active" && (
                          <button
                            onClick={() => onResolveAlert(alert.id)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-ok/30 bg-ok/10 text-ok hover:bg-ok/20 transition font-medium cursor-pointer"
                          >
                            <Check className="size-3.5" /> Resolve Alert
                          </button>
                        )}
                        <button
                          onClick={() => toggleExpand(alert.id)}
                          className="flex-1 px-3 py-2 rounded-lg border border-border bg-panel-2/50 text-muted hover:text-foreground transition font-medium cursor-pointer text-center"
                        >
                          Close Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

import { Bell } from "lucide-react";

export function Header({
  dataMode,
  unreadCount = 0,
  onBellClick,
}: {
  dataMode?: "live" | "mock";
  unreadCount?: number;
  onBellClick?: () => void;
}) {
  return (
    <header className="border-b border-border bg-panel/60 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-5 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="group grid size-10 place-items-center">
            <svg viewBox="0 0 32 32" className="size-10">
              <circle cx="16" cy="16" r="14" className="fill-accent" />
              <g className="origin-center transition-transform duration-700 group-hover:rotate-45">
                <path d="M16 6 L19 16 L16 13 L13 16 Z" className="fill-white" />
                <path d="M16 26 L13 16 L16 19 L19 16 Z" className="fill-white/55" />
              </g>
              <circle cx="16" cy="16" r="1.4" className="fill-white" />
            </svg>
          </div>
          <div className="leading-none">
            <div className="font-semibold tracking-tight text-[15px]">
              Route <span className="text-accent">Pilote</span>
            </div>
            <div className="text-[10px] text-muted mono mt-1.5 tracking-[0.18em]">
              SUPPLY-CHAIN RISK INTELLIGENCE
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] mono">
          {dataMode && (
            <span
              className={
                "px-2 py-1 rounded-md border " +
                (dataMode === "live"
                  ? "border-ok/40 text-ok bg-ok/10"
                  : "border-warn/40 text-warn bg-warn/10")
              }
            >
              {dataMode === "live" ? "● LIVE DATA" : "● DEMO DATA"}
            </span>
          )}
          {onBellClick && (
            <button
              onClick={onBellClick}
              className="relative p-2 rounded-lg border border-border bg-panel-2/40 hover:bg-panel-2/80 hover:border-accent/40 text-foreground transition duration-200 cursor-pointer flex items-center justify-center"
              aria-label="Notification Center"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white tabular-nums shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}


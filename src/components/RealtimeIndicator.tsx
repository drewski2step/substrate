import { cn } from "@/lib/utils";

export function RealtimeIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono">
      <span className={cn(
        "w-2 h-2 rounded-full transition-colors",
        connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
      )} />
      <span className={cn("text-muted-foreground", !connected && "text-amber-600")}>
        {connected ? "Live" : "Reconnecting..."}
      </span>
    </div>
  );
}

import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

function getHeatColor(heat: number) {
  if (heat <= 0) return "text-muted-foreground";
  if (heat <= 20) return "text-blue-500";
  if (heat <= 50) return "text-teal-500";
  if (heat <= 100) return "text-amber-500";
  if (heat <= 200) return "text-orange-500";
  return "text-red-500";
}

export function MissionHeatBadge({ heat }: { heat: number }) {
  if (heat <= 0) return null;
  const color = getHeatColor(heat);
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-mono font-medium tabular-nums", color)}>
      <Flame className={cn("w-3 h-3", heat > 200 && "animate-pulse")} />
      {heat}
    </span>
  );
}

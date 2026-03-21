import { TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-substrate-open/10 text-substrate-open border-substrate-open/20" },
  active: { label: "Active", className: "bg-substrate-active/10 text-substrate-active border-substrate-active/20" },
  complete: { label: "Complete", className: "bg-muted text-muted-foreground border-border" },
  blocked: { label: "Blocked", className: "bg-substrate-blocked/10 text-substrate-blocked border-substrate-blocked/20" },
  locked: { label: "Locked", className: "bg-muted/50 text-substrate-locked border-border" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border", config.className)}>
      {config.label}
    </span>
  );
}

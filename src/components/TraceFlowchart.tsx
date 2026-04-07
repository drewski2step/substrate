import { useState, useMemo, useRef, useCallback } from "react";
import { TraceEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Check, ChevronDown, ChevronRight, GitBranch, Lock, Plus, Trash2, GripVertical, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatBox } from "@/components/ChatBox";
import { format } from "date-fns";

interface TraceFlowchartProps {
  traces: TraceEntry[];
  depth?: number;
  missionId: string;
  taskId: string;
  parentPath?: string[];
  onAddTrace: (parentPath: string[], entry: Omit<TraceEntry, "id" | "timestamp">) => void;
  onUpdateTraceDeps: (traceId: string, deps: string[]) => void;
  onDeleteTrace?: (tracePath: string[], traceId: string) => void;
  onChatMessage?: (tracePath: string[], agentName: string, content: string) => void;
}

const actionStatus: Record<string, string> = {
  claimed: "active",
  updated: "active",
  completed: "complete",
  note: "open",
  blocked: "blocked",
  unblocked: "open",
};

const statusBg: Record<string, string> = {
  complete: "bg-muted/60 border-substrate-complete/40",
  active: "bg-substrate-active/8 border-substrate-active/30",
  open: "bg-substrate-open/8 border-substrate-open/30",
  blocked: "bg-substrate-blocked/8 border-substrate-blocked/30",
  locked: "bg-muted/20 border-substrate-locked/30",
};

const statusAccent: Record<string, string> = {
  complete: "bg-substrate-complete",
  active: "bg-substrate-active",
  open: "bg-substrate-open",
  blocked: "bg-substrate-blocked",
  locked: "bg-substrate-locked",
};

function computeDepths(traces: TraceEntry[]): Map<string, number> {
  const depths = new Map<string, number>();
  const traceMap = new Map(traces.map((t) => [t.id, t]));

  function getDepth(id: string): number {
    if (depths.has(id)) return depths.get(id)!;
    const trace = traceMap.get(id);
    if (!trace || trace.dependencies.length === 0) {
      depths.set(id, 0);
      return 0;
    }
    const maxDep = Math.max(
      ...trace.dependencies.filter((depId) => traceMap.has(depId)).map((depId) => getDepth(depId))
    );
    const d = (maxDep === -Infinity ? 0 : maxDep) + 1;
    depths.set(id, d);
    return d;
  }

  traces.forEach((t) => getDepth(t.id));
  return depths;
}

function buildTiers(traces: TraceEntry[]): TraceEntry[][] {
  if (traces.length === 0) return [];
  const depths = computeDepths(traces);
  const maxDepth = Math.max(0, ...Array.from(depths.values()));
  const tiers: TraceEntry[][] = Array.from({ length: maxDepth + 1 }, () => []);
  traces.forEach((trace) => {
    const d = depths.get(trace.id) ?? 0;
    tiers[d].push(trace);
  });
  // Sort within each tier by deadline (earlier deadlines lower / closer to root)
  tiers.forEach((tier) => {
    tier.sort((a, b) => {
      if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });
  });
  return tiers;
}

function TierConnectors({ tierAbove, tierBelow }: { tierAbove: TraceEntry[]; tierBelow: TraceEntry[] }) {
  const lines: { fromIdx: number; toIdx: number; fromCount: number; toCount: number; complete: boolean }[] = [];

  tierAbove.forEach((trace, fromIdx) => {
    trace.dependencies.forEach((depId) => {
      const toIdx = tierBelow.findIndex((t) => t.id === depId);
      if (toIdx !== -1) {
        lines.push({
          fromIdx, toIdx,
          fromCount: tierAbove.length,
          toCount: tierBelow.length,
          complete: tierBelow[toIdx].action === "completed",
        });
      }
    });
  });

  if (lines.length === 0) return null;
  const width = Math.max(tierAbove.length, tierBelow.length) * 196;
  const height = 32;

  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible" style={{ minWidth: width }}>
      {lines.map((line, i) => {
        const fromX = (line.fromIdx + 0.5) * (width / line.fromCount);
        const toX = (line.toIdx + 0.5) * (width / line.toCount);
        return (
          <line key={i} x1={fromX} y1={0} x2={toX} y2={height}
            stroke={line.complete ? "hsl(var(--substrate-complete))" : "hsl(var(--border))"}
            strokeWidth={line.complete ? 2 : 1.5}
            strokeDasharray={line.complete ? undefined : "4 3"}
          />
        );
      })}
    </svg>
  );
}

function TraceNode({
  trace, allTraces, depth, missionId, taskId, parentPath,
  onAddTrace, onUpdateTraceDeps, onDeleteTrace, onChatMessage,
  onDragStart, onDragOver, onDrop,
}: {
  trace: TraceEntry;
  allTraces: TraceEntry[];
  depth: number;
  missionId: string;
  taskId: string;
  parentPath: string[];
  onAddTrace: TraceFlowchartProps["onAddTrace"];
  onUpdateTraceDeps: TraceFlowchartProps["onUpdateTraceDeps"];
  onDeleteTrace?: TraceFlowchartProps["onDeleteTrace"];
  onChatMessage?: TraceFlowchartProps["onChatMessage"];
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSubTraces = trace.subTraces.length > 0;
  const status = actionStatus[trace.action] || "open";

  return (
    <div
      className="relative group w-48 shrink-0"
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(trace.id); }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e); }}
      onDrop={(e) => { e.preventDefault(); onDrop(trace.id); }}
    >
      <div
        className={cn(
          "relative border-2 rounded-lg px-4 py-3 transition-all cursor-pointer",
          statusBg[status],
          "hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.02] active:scale-[0.98]",
          status === "open" && "animate-pulse-subtle"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className={cn("absolute top-0 left-3 right-3 h-0.5 rounded-b", statusAccent[status])} />

        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-50 cursor-grab">
          <GripVertical className="w-3 h-3" />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <div className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
            status === "complete" && "bg-primary border-primary",
            status === "locked" && "border-substrate-locked bg-muted/50",
            status === "open" && "border-substrate-open bg-substrate-open/10",
            status === "active" && "border-substrate-active bg-substrate-active/10",
            status === "blocked" && "border-substrate-blocked bg-substrate-blocked/10"
          )}>
            {status === "complete" && <Check className="w-3 h-3 text-primary-foreground" />}
            {status === "locked" && <Lock className="w-2.5 h-2.5 text-substrate-locked" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold leading-tight uppercase tracking-wider">{trace.action}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums font-mono">
                {new Date(trace.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            <p className="text-[11px] text-foreground/80 leading-tight mt-0.5 line-clamp-2">{trace.content}</p>
            <span className="text-[10px] text-muted-foreground font-mono">{trace.agentName}</span>
            {trace.deadline && (
              <span className="text-[10px] text-primary font-mono block">
                Due: {new Date(trace.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        </div>

        {hasSubTraces && (
          <div className="flex items-center gap-1 mt-1.5">
            <span className="flex items-center gap-0.5 text-[10px] text-primary">
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <GitBranch className="w-3 h-3" />
              {trace.subTraces.length} sub-trace{trace.subTraces.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-accent text-[10px] font-medium text-accent-foreground shadow-sm hover:bg-accent/80 transition-colors"
        >
          <GitBranch className="w-3 h-3" /> Expand
        </button>
        {onDeleteTrace && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteTrace(parentPath, trace.id); }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-destructive text-[10px] font-medium text-destructive-foreground shadow-sm hover:bg-destructive/80 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-4 border border-border rounded-lg p-4 bg-card/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-mono">
              Sub-traces of "{trace.action}"
            </span>
          </div>
          <TraceFlowchart
            traces={trace.subTraces}
            depth={depth + 1}
            missionId={missionId}
            taskId={taskId}
            parentPath={[...parentPath, trace.id]}
            onAddTrace={onAddTrace}
            onUpdateTraceDeps={onUpdateTraceDeps}
            onDeleteTrace={onDeleteTrace}
            onChatMessage={onChatMessage}
          />
          {onChatMessage && (
            <div className="mt-3">
              <ChatBox
                messages={trace.chatMessages}
                onSendMessage={(name, msg) => onChatMessage([...parentPath, trace.id], name, msg)}
                label="Trace chat"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddTraceDialog({
  open, onOpenChange, traces, onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  traces: TraceEntry[];
  onAdd: (entry: Omit<TraceEntry, "id" | "timestamp">, deps: string[]) => void;
}) {
  const [content, setContent] = useState("");
  const [action, setAction] = useState<TraceEntry["action"]>("note");
  const [agentName, setAgentName] = useState("");
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<Date | undefined>();

  const reset = () => { setContent(""); setAction("note"); setAgentName(""); setSelectedDeps([]); setDeadline(undefined); };

  const handleCreate = () => {
    if (!content.trim() || !agentName.trim()) return;
    onAdd(
      {
        taskId: "",
        agentId: "manual",
        agentName: agentName.trim(),
        action,
        content: content.trim(),
        deadline: deadline?.toISOString(),
        dependencies: selectedDeps,
        subTraces: [],
        chatMessages: [],
      },
      selectedDeps
    );
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Add trace entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Agent name" value={agentName} onChange={(e) => setAgentName(e.target.value)} className="text-sm" />
          <Select value={action} onValueChange={(v) => setAction(v as TraceEntry["action"])}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="claimed">Claimed</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="unblocked">Unblocked</SelectItem>
            </SelectContent>
          </Select>
          <Textarea placeholder="What happened?" value={content} onChange={(e) => setContent(e.target.value)} className="text-sm min-h-[80px]" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !deadline && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deadline ? format(deadline, "PPP") : "Deadline (optional)"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {traces.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Depends on:</p>
              <div className="flex flex-wrap gap-1">
                {traces.map((t) => (
                  <Button key={t.id} variant={selectedDeps.includes(t.id) ? "default" : "outline"} size="sm" className="h-6 text-[10px]"
                    onClick={() => setSelectedDeps((prev) => prev.includes(t.id) ? prev.filter((d) => d !== t.id) : [...prev, t.id])}
                  >
                    {selectedDeps.includes(t.id) && <Check className="w-2.5 h-2.5 mr-0.5" />}
                    {t.action}: {t.content.slice(0, 30)}…
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button size="sm" onClick={handleCreate} disabled={!content.trim() || !agentName.trim()}>Add entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TraceFlowchart({
  traces, depth = 0, missionId, taskId, parentPath = [],
  onAddTrace, onUpdateTraceDeps, onDeleteTrace, onChatMessage,
}: TraceFlowchartProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const tiers = useMemo(() => buildTiers(traces), [traces]);
  const reversedTiers = useMemo(() => [...tiers].reverse(), [tiers]);

  const handleDrop = useCallback((targetId: string) => {
    if (!dragId || dragId === targetId) return;
    // Swap dependencies as a simple reorder mechanism
    setDragId(null);
  }, [dragId]);

  if (traces.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground mb-3">No trace entries yet.</p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-3 h-3" /> Add first trace
        </Button>
        <AddTraceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} traces={traces} onAdd={(entry) => onAddTrace(parentPath, entry)} />
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="flex flex-col items-center gap-0 min-w-fit">
          {reversedTiers.map((tier, tierIdx) => {
            const actualDepth = tiers.length - 1 - tierIdx;
            const nextTierBelow = tierIdx < reversedTiers.length - 1 ? reversedTiers[tierIdx + 1] : null;
            return (
              <div key={actualDepth} className="flex flex-col items-center">
                <div className="flex items-start justify-center gap-3">
                  {tier.map((trace) => (
                    <TraceNode
                      key={trace.id} trace={trace} allTraces={traces} depth={depth}
                      missionId={missionId} taskId={taskId} parentPath={parentPath}
                      onAddTrace={onAddTrace} onUpdateTraceDeps={onUpdateTraceDeps}
                      onDeleteTrace={onDeleteTrace} onChatMessage={onChatMessage}
                      onDragStart={setDragId}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                    />
                  ))}
                </div>
                {nextTierBelow && (
                  <div className="flex justify-center py-0">
                    <TierConnectors tierAbove={tier} tierBelow={nextTierBelow} />
                  </div>
                )}
              </div>
            );
          })}
          {depth === 0 && (
            <div className="mt-3 px-3 py-1 bg-muted rounded text-xs text-muted-foreground font-medium font-mono">Root</div>
          )}
        </div>
      </div>
      <div className="flex justify-center pt-3">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-3 h-3" />
          {depth === 0 ? "Add trace" : "Add sub-trace"}
        </Button>
      </div>
      <AddTraceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} traces={traces} onAdd={(entry) => onAddTrace(parentPath, entry)} />
    </div>
  );
}

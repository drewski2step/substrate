import { useState } from "react";
import { TraceEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Check, ChevronDown, ChevronRight, GitBranch, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TraceFlowchartProps {
  traces: TraceEntry[];
  depth?: number;
  missionId: string;
  taskId: string;
  parentPath?: string[];
  onAddTrace: (parentPath: string[], entry: Omit<TraceEntry, "id" | "timestamp">) => void;
  onUpdateTraceDeps: (traceId: string, deps: string[]) => void;
}

const actionColors: Record<string, string> = {
  claimed: "border-primary/40 bg-primary/5",
  updated: "border-accent/40 bg-accent/5",
  completed: "border-green-500/40 bg-green-500/5",
  note: "border-muted-foreground/30 bg-muted/50",
  blocked: "border-destructive/40 bg-destructive/5",
  unblocked: "border-primary/40 bg-primary/5",
};

const actionDot: Record<string, string> = {
  claimed: "bg-primary",
  updated: "bg-accent-foreground",
  completed: "bg-green-500",
  note: "bg-muted-foreground",
  blocked: "bg-destructive",
  unblocked: "bg-primary",
};

function computeTraceTiers(traces: TraceEntry[]): TraceEntry[][] {
  if (traces.length === 0) return [];
  const depthMap = new Map<string, number>();

  function getDepth(trace: TraceEntry, visited: Set<string>): number {
    if (depthMap.has(trace.id)) return depthMap.get(trace.id)!;
    if (visited.has(trace.id)) return 0;
    visited.add(trace.id);
    let maxDep = -1;
    for (const depId of trace.dependencies) {
      const dep = traces.find((t) => t.id === depId);
      if (dep) maxDep = Math.max(maxDep, getDepth(dep, visited));
    }
    const d = maxDep + 1;
    depthMap.set(trace.id, d);
    return d;
  }

  traces.forEach((t) => getDepth(t, new Set()));

  const tierMap = new Map<number, TraceEntry[]>();
  traces.forEach((t) => {
    const d = depthMap.get(t.id) || 0;
    if (!tierMap.has(d)) tierMap.set(d, []);
    tierMap.get(d)!.push(t);
  });

  const sorted = Array.from(tierMap.keys()).sort((a, b) => a - b);
  return sorted.map((k) => tierMap.get(k)!);
}

function TraceNode({
  trace,
  allTraces,
  depth,
  missionId,
  taskId,
  parentPath,
  onAddTrace,
  onUpdateTraceDeps,
}: {
  trace: TraceEntry;
  allTraces: TraceEntry[];
  depth: number;
  missionId: string;
  taskId: string;
  parentPath: string[];
  onAddTrace: TraceFlowchartProps["onAddTrace"];
  onUpdateTraceDeps: TraceFlowchartProps["onUpdateTraceDeps"];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSubTraces = trace.subTraces.length > 0;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={cn(
          "relative border rounded-lg px-3 py-2 min-w-[180px] max-w-[240px] transition-all group cursor-pointer",
          actionColors[trace.action] || "border-border bg-card"
        )}
        onClick={() => hasSubTraces && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className={cn("w-2 h-2 rounded-full shrink-0", actionDot[trace.action] || "bg-muted-foreground")} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {trace.action}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
            {new Date(trace.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-foreground/80 line-clamp-3">{trace.content}</p>
        <div className="text-[10px] text-muted-foreground mt-1">{trace.agentName}</div>

        {/* Sub-trace indicator */}
        <div className="flex items-center gap-1 mt-1.5">
          {hasSubTraces && (
            <button className="flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 transition-colors">
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <GitBranch className="w-3 h-3" />
              <span>{trace.subTraces.length} sub-trace{trace.subTraces.length !== 1 ? "s" : ""}</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded sub-trace flowchart */}
      {expanded && hasSubTraces && (
        <div className="ml-4 mt-2 pl-3 border-l-2 border-dashed border-primary/20">
          <TraceFlowchart
            traces={trace.subTraces}
            depth={depth + 1}
            missionId={missionId}
            taskId={taskId}
            parentPath={[...parentPath, trace.id]}
            onAddTrace={onAddTrace}
            onUpdateTraceDeps={onUpdateTraceDeps}
          />
        </div>
      )}
    </div>
  );
}

function AddTraceDialog({
  open,
  onOpenChange,
  traces,
  onAdd,
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

  const reset = () => {
    setContent("");
    setAction("note");
    setAgentName("");
    setSelectedDeps([]);
  };

  const handleCreate = () => {
    if (!content.trim() || !agentName.trim()) return;
    onAdd(
      {
        taskId: "",
        agentId: "manual",
        agentName: agentName.trim(),
        action,
        content: content.trim(),
        dependencies: selectedDeps,
        subTraces: [],
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
          {traces.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Depends on:</p>
              <div className="flex flex-wrap gap-1">
                {traces.map((t) => (
                  <Button
                    key={t.id}
                    variant={selectedDeps.includes(t.id) ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-[10px]"
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
          <Button size="sm" onClick={handleCreate} disabled={!content.trim() || !agentName.trim()}>
            Add entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TraceFlowchart({
  traces,
  depth = 0,
  missionId,
  taskId,
  parentPath = [],
  onAddTrace,
  onUpdateTraceDeps,
}: TraceFlowchartProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const tiers = computeTraceTiers(traces);

  if (traces.length === 0 && depth === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground mb-3">No trace entries yet.</p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-3 h-3" /> Add first trace
        </Button>
        <AddTraceDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          traces={traces}
          onAdd={(entry) => onAddTrace(parentPath, entry)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Tiers rendered bottom-up like the mission flowchart */}
      <div className="flex flex-col-reverse gap-4">
        {tiers.map((tier, tierIdx) => (
          <div key={tierIdx}>
            {/* Connectors */}
            {tierIdx < tiers.length - 1 && (
              <div className="flex justify-center py-1">
                <div className="w-px h-4 bg-border" />
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              {tier.map((trace) => (
                <TraceNode
                  key={trace.id}
                  trace={trace}
                  allTraces={traces}
                  depth={depth}
                  missionId={missionId}
                  taskId={taskId}
                  parentPath={parentPath}
                  onAddTrace={onAddTrace}
                  onUpdateTraceDeps={onUpdateTraceDeps}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add trace button */}
      <div className="flex justify-center pt-3">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-3 h-3" />
          {depth === 0 ? "Add trace" : "Add sub-trace"}
        </Button>
      </div>

      <AddTraceDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        traces={traces}
        onAdd={(entry) => onAddTrace(parentPath, entry)}
      />
    </div>
  );
}

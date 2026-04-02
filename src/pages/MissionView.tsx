import { useParams, Link } from "react-router-dom";
import { useSubstrate } from "@/lib/substrate-context";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { AddSuccessorDialog } from "@/components/AddSuccessorDialog";
import { cn } from "@/lib/utils";
import { Check, Lock, ArrowLeft, CheckCircle2, Plus } from "lucide-react";
import { Task } from "@/lib/types";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

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

function computeDepths(tasks: Task[]): Map<string, number> {
  const depths = new Map<string, number>();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  function getDepth(id: string): number {
    if (depths.has(id)) return depths.get(id)!;
    const task = taskMap.get(id);
    if (!task || task.dependencies.length === 0) {
      depths.set(id, 0);
      return 0;
    }
    const maxDepDep = Math.max(...task.dependencies.map((depId) => getDepth(depId)));
    const d = maxDepDep + 1;
    depths.set(id, d);
    return d;
  }

  tasks.forEach((t) => getDepth(t.id));
  return depths;
}

function buildTiers(tasks: Task[]): Task[][] {
  const depths = computeDepths(tasks);
  const maxDepth = Math.max(0, ...Array.from(depths.values()));
  const tiers: Task[][] = Array.from({ length: maxDepth + 1 }, () => []);

  tasks.forEach((task) => {
    const d = depths.get(task.id) ?? 0;
    tiers[d].push(task);
  });

  return tiers;
}

function TraceBlock({
  task,
  missionId,
  onComplete,
  onAddSuccessor,
}: {
  task: Task;
  missionId: string;
  onComplete: (taskId: string) => void;
  onAddSuccessor: (task: Task) => void;
}) {
  const isLocked = task.status === "locked";
  const canComplete = task.status === "active" || task.status === "open";

  return (
    <div className="relative group w-48 shrink-0">
      <Link
        to={isLocked ? "#" : `/mission/${missionId}/task/${task.id}`}
        className={cn(
          "relative border-2 rounded-lg px-4 py-3 transition-all block",
          statusBg[task.status],
          isLocked
            ? "cursor-default opacity-50"
            : "hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
          task.status === "open" && "animate-pulse-subtle"
        )}
      >
        <div className={cn("absolute top-0 left-3 right-3 h-0.5 rounded-b", statusAccent[task.status])} />

        <div className="flex items-center gap-2 pt-1">
          <div
            className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
              task.status === "complete" && "bg-primary border-primary",
              task.status === "locked" && "border-substrate-locked bg-muted/50",
              task.status === "open" && "border-substrate-open bg-substrate-open/10",
              task.status === "active" && "border-substrate-active bg-substrate-active/10",
              task.status === "blocked" && "border-substrate-blocked bg-substrate-blocked/10"
            )}
          >
            {task.status === "complete" && <Check className="w-3 h-3 text-primary-foreground" />}
            {task.status === "locked" && <Lock className="w-2.5 h-2.5 text-substrate-locked" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn("text-xs font-semibold leading-tight", isLocked && "text-muted-foreground")}>
                {task.title}
              </span>
              <StatusBadge status={task.status} />
            </div>
            <span className="text-[10px] text-muted-foreground leading-tight block mt-0.5 font-mono">
              {task.requiredAgentType}
            </span>
            {task.assignedAgentName && (
              <span className="text-[10px] text-muted-foreground font-mono">→ {task.assignedAgentName}</span>
            )}
          </div>
        </div>
      </Link>

      {/* Action buttons — visible on hover */}
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {canComplete && (
          <button
            onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-substrate-open text-[10px] font-medium text-primary-foreground shadow-sm hover:bg-substrate-open/80 transition-colors"
            title="Mark complete"
          >
            <CheckCircle2 className="w-3 h-3" />
            Done
          </button>
        )}
        {!isLocked && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddSuccessor(task); }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-accent text-[10px] font-medium text-accent-foreground shadow-sm hover:bg-accent/80 transition-colors"
            title="Add successor trace"
          >
            <Plus className="w-3 h-3" />
            Next
          </button>
        )}
      </div>
    </div>
  );
}

function TierConnectors({
  tierAbove,
  tierBelow,
  tasks,
}: {
  tierAbove: Task[];
  tierBelow: Task[];
  tasks: Task[];
}) {
  const lines: { fromIdx: number; toIdx: number; fromCount: number; toCount: number; complete: boolean }[] = [];

  tierAbove.forEach((task, fromIdx) => {
    task.dependencies.forEach((depId) => {
      const toIdx = tierBelow.findIndex((t) => t.id === depId);
      if (toIdx !== -1) {
        const depTask = tierBelow[toIdx];
        lines.push({
          fromIdx,
          toIdx,
          fromCount: tierAbove.length,
          toCount: tierBelow.length,
          complete: depTask.status === "complete",
        });
      }
    });
  });

  if (lines.length === 0) return null;

  const width = Math.max(tierAbove.length, tierBelow.length) * 208;
  const height = 32;

  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible" style={{ minWidth: width }}>
      {lines.map((line, i) => {
        const fromX = (line.fromIdx + 0.5) * (width / line.fromCount);
        const toX = (line.toIdx + 0.5) * (width / line.toCount);
        return (
          <line
            key={i}
            x1={fromX}
            y1={0}
            x2={toX}
            y2={height}
            stroke={line.complete ? "hsl(var(--substrate-complete))" : "hsl(var(--border))"}
            strokeWidth={line.complete ? 2 : 1.5}
            strokeDasharray={line.complete ? undefined : "4 3"}
          />
        );
      })}
    </svg>
  );
}

export default function MissionView() {
  const { missionId } = useParams<{ missionId: string }>();
  const { getMission, addTask, completeTask } = useSubstrate();
  const mission = getMission(missionId || "");
  const [successorParent, setSuccessorParent] = useState<Task | null>(null);

  const tiers = useMemo(() => (mission ? buildTiers(mission.tasks) : []), [mission]);

  if (!mission) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-muted-foreground">Mission not found.</p>
        </main>
      </div>
    );
  }

  const complete = mission.tasks.filter((t) => t.status === "complete").length;
  const pct = Math.round((complete / mission.tasks.length) * 100);

  const reversedTiers = [...tiers].reverse();

  const handleComplete = (taskId: string) => {
    completeTask(mission.id, taskId);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-6 font-mono">
            <ArrowLeft className="w-3 h-3" />
            Missions
          </Link>
          <h1 className="text-2xl font-semibold leading-tight">{mission.title}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{mission.description}</p>
          {mission.location && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">{mission.location}</p>
          )}
          <div className="flex items-center gap-3 mt-4">
            <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums font-mono">{pct}% complete</span>
          </div>
        </div>

        <div className="mt-10 animate-fade-in-up-delay-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Trace graph</h2>
            <CreateTaskDialog missionId={mission.id} existingTasks={mission.tasks} onCreateTask={addTask} />
          </div>

          <div className="overflow-x-auto pb-4">
            <div className="flex flex-col items-center gap-0 min-w-fit">
              {reversedTiers.map((tier, tierIdx) => {
                const actualDepth = tiers.length - 1 - tierIdx;
                const nextTierBelow = tierIdx < reversedTiers.length - 1 ? reversedTiers[tierIdx + 1] : null;

                return (
                  <div key={actualDepth} className="flex flex-col items-center">
                    <div className="flex items-start justify-center gap-3">
                      {tier.map((task) => (
                        <TraceBlock
                          key={task.id}
                          task={task}
                          missionId={mission.id}
                          onComplete={handleComplete}
                          onAddSuccessor={setSuccessorParent}
                        />
                      ))}
                    </div>

                    {nextTierBelow && (
                      <div className="flex justify-center py-0">
                        <TierConnectors
                          tierAbove={tier}
                          tierBelow={nextTierBelow}
                          tasks={mission.tasks}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="mt-3 px-3 py-1 bg-muted rounded text-xs text-muted-foreground font-medium font-mono">
                Foundation
              </div>
            </div>
          </div>
        </div>

        {successorParent && (
          <AddSuccessorDialog
            open={!!successorParent}
            onOpenChange={(v) => { if (!v) setSuccessorParent(null); }}
            parentTask={successorParent}
            missionId={mission.id}
            onCreateTask={addTask}
          />
        )}
      </main>
    </div>
  );
}

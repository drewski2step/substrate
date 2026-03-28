import { useParams, Link } from "react-router-dom";
import { useSubstrate } from "@/lib/substrate-context";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { cn } from "@/lib/utils";
import { Check, Lock, ArrowLeft, ArrowUp } from "lucide-react";
import { Task } from "@/lib/types";

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

function TaskBlock({ task, mission, tasks }: { task: Task; mission: { id: string }; tasks: Task[] }) {
  const isLocked = task.status === "locked";
  const deps = task.dependencies
    .map((id) => tasks.find((t) => t.id === id))
    .filter(Boolean) as Task[];

  return (
    <div className="flex flex-col items-center">
      {/* Connector line going up to this block */}
      {deps.length > 0 && (
        <div className="flex flex-col items-center mb-1">
          <ArrowUp className="w-3 h-3 text-border" />
          <div className="w-px h-4 bg-border" />
          {deps.length > 1 && (
            <div className="flex items-center gap-1 mb-1">
              {deps.map((d) => (
                <span
                  key={d.id}
                  className={cn(
                    "w-2 h-2 rounded-full",
                    d.status === "complete" ? "bg-substrate-complete" : "bg-border"
                  )}
                  title={d.title}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Link
        to={isLocked ? "#" : `/mission/${mission.id}/task/${task.id}`}
        className={cn(
          "relative w-full max-w-md border-2 rounded-lg px-4 py-3 transition-all",
          statusBg[task.status],
          isLocked
            ? "cursor-default opacity-50"
            : "hover:shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer",
          task.status === "open" && "animate-pulse-subtle"
        )}
      >
        {/* Top accent bar */}
        <div className={cn("absolute top-0 left-3 right-3 h-0.5 rounded-b", statusAccent[task.status])} />

        <div className="flex items-center gap-3 pt-1">
          <div
            className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0",
              task.status === "complete" && "bg-foreground border-foreground",
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
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-semibold", isLocked && "text-muted-foreground")}>
                {task.title}
              </span>
              <StatusBadge status={task.status} />
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-muted-foreground">{task.requiredAgentType}</span>
              {task.assignedAgentName && (
                <span className="text-xs text-muted-foreground">→ {task.assignedAgentName}</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

export default function MissionView() {
  const { missionId } = useParams<{ missionId: string }>();
  const { getMission, addTask } = useSubstrate();
  const mission = getMission(missionId || "");

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

  // Reverse tasks so they stack upward — first task at the bottom
  const reversedTasks = [...mission.tasks].reverse();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-3 h-3" />
            Missions
          </Link>
          <h1 className="text-2xl font-semibold leading-tight">{mission.title}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{mission.description}</p>
          {mission.location && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">{mission.location}</p>
          )}
          <div className="flex items-center gap-3 mt-4">
            <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-foreground rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{pct}% complete</span>
          </div>
        </div>

        <div className="mt-10 animate-fade-in-up-delay-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Task graph</h2>
            <CreateTaskDialog missionId={mission.id} existingTasks={mission.tasks} onCreateTask={addTask} />
          </div>

          {/* Flowchart — stacks upward, foundation at bottom */}
          <div className="flex flex-col items-center gap-2">
            {reversedTasks.map((task) => (
              <TaskBlock key={task.id} task={task} mission={mission} tasks={mission.tasks} />
            ))}

            {/* Base label */}
            <div className="mt-2 px-3 py-1 bg-muted rounded text-xs text-muted-foreground font-medium">
              Foundation ↑
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import { useParams, Link } from "react-router-dom";
import { useSubstrate } from "@/lib/substrate-context";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { Check, Lock, ArrowLeft } from "lucide-react";

export default function MissionView() {
  const { missionId } = useParams<{ missionId: string }>();
  const { getMission } = useSubstrate();
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
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Task graph</h2>
          <div className="space-y-0">
            {mission.tasks.map((task, i) => {
              const isLocked = task.status === "locked";
              return (
                <div key={task.id}>
                  {i > 0 && (
                    <div className="ml-4 w-px h-4 bg-border" />
                  )}
                  <Link
                    to={isLocked ? "#" : `/mission/${mission.id}/task/${task.id}`}
                    className={cn(
                      "block border rounded-lg p-4 transition-all",
                      isLocked
                        ? "border-border/50 bg-muted/30 cursor-default"
                        : "border-border hover:bg-card hover:shadow-sm active:scale-[0.998] cursor-pointer",
                      task.status === "open" && "animate-pulse-subtle"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border flex items-center justify-center shrink-0",
                          task.status === "complete" && "bg-foreground border-foreground",
                          task.status === "locked" && "border-substrate-locked bg-muted/50",
                          task.status === "open" && "border-substrate-open",
                          task.status === "active" && "border-substrate-active bg-substrate-active/10",
                          task.status === "blocked" && "border-substrate-blocked"
                        )}
                      >
                        {task.status === "complete" && <Check className="w-3 h-3 text-primary-foreground" />}
                        {task.status === "locked" && <Lock className="w-2.5 h-2.5 text-substrate-locked" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-medium", isLocked && "text-muted-foreground")}>
                            {task.title}
                          </span>
                          <StatusBadge status={task.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">{task.requiredAgentType}</span>
                          {task.assignedAgentName && (
                            <span className="text-xs text-muted-foreground">→ {task.assignedAgentName}</span>
                          )}
                          {task.status === "complete" && task.traces.length > 0 && (
                            <span className="text-xs text-muted-foreground italic truncate max-w-xs">
                              {task.traces[task.traces.length - 1].content.slice(0, 60)}…
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

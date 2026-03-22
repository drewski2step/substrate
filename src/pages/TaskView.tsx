import { useParams, Link, useNavigate } from "react-router-dom";
import { useSubstrate } from "@/lib/substrate-context";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Check, MapPin, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TraceEntry } from "@/lib/types";

function TraceItem({ entry }: { entry: TraceEntry }) {
  const actionLabels: Record<string, string> = {
    claimed: "claimed",
    updated: "updated",
    completed: "completed",
    note: "noted",
    blocked: "blocked",
    unblocked: "unblocked",
  };

  return (
    <div className="flex gap-3 py-3">
      <div className="w-1.5 h-1.5 rounded-full bg-border mt-2 shrink-0" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{entry.agentName}</span>
          <span className="text-xs text-muted-foreground">{actionLabels[entry.action] || entry.action}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{entry.content}</p>
      </div>
    </div>
  );
}

export default function TaskView() {
  const navigate = useNavigate();
  const { missionId, taskId } = useParams<{ missionId: string; taskId: string }>();
  const { getMission, getTask, completeTask, claimTask, deleteTask, agents } = useSubstrate();
  const mission = getMission(missionId || "");
  const task = getTask(missionId || "", taskId || "");

  if (!mission || !task) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-muted-foreground">Task not found.</p>
        </main>
      </div>
    );
  }

  // Gather upstream traces for context
  const upstreamTraces: TraceEntry[] = [];
  const visited = new Set<string>();
  function collectUpstream(depIds: string[]) {
    for (const depId of depIds) {
      if (visited.has(depId)) continue;
      visited.add(depId);
      const depTask = mission.tasks.find((t) => t.id === depId);
      if (depTask) {
        upstreamTraces.push(...depTask.traces);
        collectUpstream(depTask.dependencies);
      }
    }
  }
  collectUpstream(task.dependencies);
  upstreamTraces.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const suggestedAgents = agents.filter((a) => task.suggestedAgentIds.includes(a.id));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up">
          <Link
            to={`/mission/${missionId}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-3 h-3" />
            {mission.title}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left panel */}
          <div className="lg:col-span-2 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold leading-tight">{task.title}</h1>
              <StatusBadge status={task.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{task.description}</p>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-24">Agent type</span>
                <span className="font-medium">{task.requiredAgentType}</span>
              </div>
              {task.locationRadius && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-24">Location</span>
                  <span className="font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {task.locationRadius}
                  </span>
                </div>
              )}
              {task.assignedAgentName && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-24">Assigned</span>
                  <Link to={`/agent/${task.assignedAgentId}`} className="font-medium hover:underline">
                    {task.assignedAgentName}
                  </Link>
                </div>
              )}
              {task.dependencies.length > 0 && (
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground w-24 shrink-0">Depends on</span>
                  <div className="flex flex-wrap gap-1">
                    {task.dependencies.map((depId) => {
                      const dep = mission.tasks.find((t) => t.id === depId);
                      return (
                        <span key={depId} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs">
                          {dep?.status === "complete" && <Check className="w-2.5 h-2.5" />}
                          {dep?.title || depId}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {task.status === "active" && (
              <Button
                className="mt-6"
                size="sm"
                onClick={() => completeTask(mission.id, task.id)}
              >
                Mark complete
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="mt-3 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete task
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the task and clear it from any dependency lists. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      deleteTask(mission.id, task.id);
                      navigate(`/mission/${missionId}`);
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Suggested Agents */}
            {suggestedAgents.length > 0 && (task.status === "open") && (
              <div className="mt-8">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Suggested agents</h3>
                <div className="space-y-2">
                  {suggestedAgents.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                      <div>
                        <Link to={`/agent/${agent.id}`} className="text-sm font-medium hover:underline">
                          {agent.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            {agent.reputationScore}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {agent.location}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => claimTask(mission.id, task.id, agent.id)}
                      >
                        Invite
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right panel — Trace */}
          <div className="lg:col-span-3 animate-fade-in-up-delay-1">
            <div className="border border-border rounded-lg p-5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Trace</h3>
              <p className="text-xs text-muted-foreground mb-4">Chronological record of actions on this task.</p>

              {task.traces.length > 0 ? (
                <div className="divide-y divide-border">
                  {task.traces.map((entry) => (
                    <TraceItem key={entry.id} entry={entry} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">No trace entries yet.</p>
              )}

              {upstreamTraces.length > 0 && (
                <>
                  <div className="border-t border-border mt-4 pt-4">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Upstream context</h4>
                    <p className="text-xs text-muted-foreground mb-3">Trace from dependency tasks — the substrate state informing this work.</p>
                    <div className={cn("divide-y divide-border", task.traces.length > 0 && "opacity-70")}>
                      {upstreamTraces.map((entry) => (
                        <TraceItem key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

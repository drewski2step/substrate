import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useSubstrate } from "@/lib/substrate-context";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { TraceFlowchart } from "@/components/TraceFlowchart";
import { ChatBox } from "@/components/ChatBox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Check, MapPin, Pencil, Star, Trash2, X, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TraceEntry } from "@/lib/types";
import { format } from "date-fns";

export default function TaskView() {
  const navigate = useNavigate();
  const { missionId, taskId } = useParams<{ missionId: string; taskId: string }>();
  const { getMission, getTask, completeTask, claimTask, deleteTask, updateTask, updateTraceInTask, addSubTrace, deleteTrace, addChatMessage, agents } = useSubstrate();
  const mission = getMission(missionId || "");
  const task = getTask(missionId || "", taskId || "");

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  if (!mission || !task) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-muted-foreground">Trace not found.</p>
        </main>
      </div>
    );
  }

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
          <Link to={`/mission/${missionId}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-6 font-mono">
            <ArrowLeft className="w-3 h-3" /> {mission.title}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold leading-tight">{task.title}</h1>
              <StatusBadge status={task.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{task.description}</p>

            <div className="mt-6 space-y-3">
              {/* Agent type */}
              <div className="flex items-center gap-2 text-xs group">
                <span className="text-muted-foreground w-24 font-mono">Agent type</span>
                {editingField === "agentType" ? (
                  <div className="flex items-center gap-1">
                    <Input className="h-6 text-xs w-40" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { updateTask(mission.id, task.id, { requiredAgentType: editValue }); setEditingField(null); } if (e.key === "Escape") setEditingField(null); }} autoFocus />
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { updateTask(mission.id, task.id, { requiredAgentType: editValue }); setEditingField(null); }}><Check className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingField(null)}><X className="w-3 h-3" /></Button>
                  </div>
                ) : (
                  <span className="font-medium cursor-pointer hover:text-primary flex items-center gap-1" onClick={() => { setEditValue(task.requiredAgentType); setEditingField("agentType"); }}>
                    {task.requiredAgentType}
                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </span>
                )}
              </div>

              {/* Location */}
              <div className="flex items-center gap-2 text-xs group">
                <span className="text-muted-foreground w-24 font-mono">Location</span>
                {editingField === "location" ? (
                  <div className="flex items-center gap-1">
                    <Input className="h-6 text-xs w-40" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { updateTask(mission.id, task.id, { locationRadius: editValue || undefined }); setEditingField(null); } if (e.key === "Escape") setEditingField(null); }} autoFocus />
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { updateTask(mission.id, task.id, { locationRadius: editValue || undefined }); setEditingField(null); }}><Check className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingField(null)}><X className="w-3 h-3" /></Button>
                  </div>
                ) : (
                  <span className="font-medium cursor-pointer hover:text-primary flex items-center gap-1" onClick={() => { setEditValue(task.locationRadius || ""); setEditingField("location"); }}>
                    <MapPin className="w-3 h-3" /> {task.locationRadius || "Not set"}
                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </span>
                )}
              </div>

              {/* Deadline */}
              <div className="flex items-center gap-2 text-xs group">
                <span className="text-muted-foreground w-24 font-mono">Deadline</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="font-medium cursor-pointer hover:text-primary flex items-center gap-1 text-xs">
                      <CalendarIcon className="w-3 h-3" />
                      {task.deadline ? format(new Date(task.deadline), "MMM d, yyyy") : "Not set"}
                      <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={task.deadline ? new Date(task.deadline) : undefined}
                      onSelect={(date) => updateTask(mission.id, task.id, { deadline: date?.toISOString() })}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Assigned */}
              <div className="flex items-center gap-2 text-xs group">
                <span className="text-muted-foreground w-24 font-mono">Assigned</span>
                {editingField === "assigned" ? (
                  <div className="flex flex-col gap-1">
                    {agents.map((agent) => (
                      <Button key={agent.id} variant={task.assignedAgentId === agent.id ? "default" : "outline"} size="sm" className="h-6 text-xs justify-start" onClick={() => { updateTask(mission.id, task.id, { assignedAgentId: agent.id, assignedAgentName: agent.name }); setEditingField(null); }}>
                        {agent.name}
                      </Button>
                    ))}
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { updateTask(mission.id, task.id, { assignedAgentId: undefined, assignedAgentName: undefined }); setEditingField(null); }}>Unassign</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditingField(null)}>Cancel</Button>
                  </div>
                ) : (
                  <span className="font-medium cursor-pointer hover:text-primary flex items-center gap-1" onClick={() => setEditingField("assigned")}>
                    {task.assignedAgentName ? (
                      <Link to={`/agent/${task.assignedAgentId}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                        {task.assignedAgentName}
                      </Link>
                    ) : "Unassigned"}
                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </span>
                )}
              </div>

              {/* Dependencies */}
              <div className="flex items-start gap-2 text-xs group">
                <span className="text-muted-foreground w-24 shrink-0 font-mono">Depends on</span>
                {editingField === "deps" ? (
                  <div className="flex flex-col gap-1">
                    {mission.tasks.filter((t) => t.id !== task.id).map((t) => {
                      const isSelected = task.dependencies.includes(t.id);
                      return (
                        <Button key={t.id} variant={isSelected ? "default" : "outline"} size="sm" className="h-6 text-xs justify-start" onClick={() => {
                          const newDeps = isSelected ? task.dependencies.filter((d) => d !== t.id) : [...task.dependencies, t.id];
                          updateTask(mission.id, task.id, { dependencies: newDeps });
                        }}>
                          {isSelected && <Check className="w-3 h-3 mr-1" />}{t.title}
                        </Button>
                      );
                    })}
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditingField(null)}>Done</Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 cursor-pointer" onClick={() => setEditingField("deps")}>
                    {task.dependencies.length > 0 ? task.dependencies.map((depId) => {
                      const dep = mission.tasks.find((t) => t.id === depId);
                      return (
                        <span key={depId} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs font-mono">
                          {dep?.status === "complete" && <Check className="w-2.5 h-2.5" />}
                          {dep?.title || depId}
                        </span>
                      );
                    }) : <span className="text-muted-foreground">None</span>}
                    <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity mt-0.5" />
                  </div>
                )}
              </div>
            </div>

            {(task.status === "active" || task.status === "open") && (
              <Button className="mt-6" size="sm" onClick={() => completeTask(mission.id, task.id)}>
                Mark complete
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="mt-3 text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Delete trace
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this trace?</AlertDialogTitle>
                  <AlertDialogDescription>This will remove the trace and clear it from any dependency lists.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { deleteTask(mission.id, task.id); navigate(`/mission/${missionId}`); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {suggestedAgents.length > 0 && (task.status === "open" || task.status === "locked") && (
              <div className="mt-8">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 font-mono">Suggested agents</h3>
                <div className="space-y-2">
                  {suggestedAgents.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                      <div>
                        <Link to={`/agent/${agent.id}`} className="text-sm font-medium hover:underline hover:text-primary">{agent.name}</Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono"><Star className="w-3 h-3" />{agent.reputationScore}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono"><MapPin className="w-3 h-3" />{agent.location}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => claimTask(mission.id, task.id, agent.id)}>Invite</Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Task-level chat */}
            <div className="mt-6">
              <ChatBox
                messages={task.chatMessages}
                onSendMessage={(name, msg) => addChatMessage(mission.id, task.id, [], name, msg)}
                label="Trace discussion"
              />
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:col-span-3 animate-fade-in-up-delay-1">
            <div className="border border-border rounded-lg p-5">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 font-mono">Sub-traces</h3>
              <p className="text-xs text-muted-foreground mb-4">Modular flowchart of actions. Click a node to expand deeper traces.</p>

              <TraceFlowchart
                traces={task.traces}
                missionId={mission.id}
                taskId={task.id}
                onAddTrace={(parentPath, entry) => {
                  const fullEntry = { ...entry, taskId: task.id };
                  addSubTrace(mission.id, task.id, parentPath, fullEntry);
                }}
                onUpdateTraceDeps={(traceId, deps) => {
                  updateTraceInTask(mission.id, task.id, traceId, { dependencies: deps });
                }}
                onDeleteTrace={(tracePath, traceId) => {
                  deleteTrace(mission.id, task.id, tracePath, traceId);
                }}
                onChatMessage={(tracePath, agentName, content) => {
                  addChatMessage(mission.id, task.id, tracePath, agentName, content);
                }}
              />

              {upstreamTraces.length > 0 && (
                <div className="border-t border-border mt-6 pt-4">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 font-mono">Upstream context</h4>
                  <p className="text-xs text-muted-foreground mb-3">Traces from dependency nodes.</p>
                  <div className={cn("opacity-70")}>
                    <TraceFlowchart traces={upstreamTraces} missionId={mission.id} taskId={task.id} onAddTrace={() => {}} onUpdateTraceDeps={() => {}} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

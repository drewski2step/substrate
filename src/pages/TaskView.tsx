import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGoal } from "@/hooks/use-goals";
import { useBlocks, useUpdateBlock, useDeleteBlock, BlockWithDeps } from "@/hooks/use-blocks";
import { useTraces, useCreateTrace, useDeleteTrace, TraceRow } from "@/hooks/use-traces";
import { toast } from "sonner";
import { format } from "date-fns";

const statusLabel: Record<string, string> = {
  pending: "Pending",
  active: "Active",
  complete: "Complete",
  stalled: "Stalled",
};

const statusColor: Record<string, string> = {
  pending: "bg-substrate-open/10 text-substrate-open border-substrate-open/20",
  active: "bg-substrate-active/10 text-substrate-active border-substrate-active/20",
  complete: "bg-muted text-muted-foreground border-border",
  stalled: "bg-substrate-blocked/10 text-substrate-blocked border-substrate-blocked/20",
};

const actionColor: Record<string, string> = {
  claimed: "border-l-substrate-active",
  updated: "border-l-substrate-open",
  completed: "border-l-substrate-complete",
  note: "border-l-muted-foreground",
  blocked: "border-l-substrate-blocked",
  unblocked: "border-l-substrate-open",
};

function AddTraceDialog({ blockId, open, onOpenChange }: { blockId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [agentName, setAgentName] = useState("");
  const [action, setAction] = useState("note");
  const [content, setContent] = useState("");
  const createTrace = useCreateTrace();

  const handleCreate = () => {
    if (!content.trim()) return;
    createTrace.mutate(
      { block_id: blockId, agent_name: agentName.trim() || "System", action, content: content.trim() },
      {
        onSuccess: () => { setAgentName(""); setContent(""); setAction("note"); onOpenChange(false); },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setAgentName(""); setContent(""); setAction("note"); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-sm">Add trace entry</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Agent name (optional)" value={agentName} onChange={(e) => setAgentName(e.target.value)} className="text-sm" />
          <Select value={action} onValueChange={setAction}>
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
        </div>
        <DialogFooter>
          <Button size="sm" onClick={handleCreate} disabled={!content.trim() || createTrace.isPending}>
            {createTrace.isPending ? "Adding..." : "Add trace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TaskView() {
  const navigate = useNavigate();
  const { missionId, taskId } = useParams<{ missionId: string; taskId: string }>();
  const { data: goal, isLoading: goalLoading } = useGoal(missionId || "");
  const { data: blocks, isLoading: blocksLoading } = useBlocks(missionId || "");
  const { data: traces, isLoading: tracesLoading } = useTraces(taskId || "");
  const updateBlock = useUpdateBlock();
  const deleteBlock = useDeleteBlock();
  const deleteTrace = useDeleteTrace();
  const [addTraceOpen, setAddTraceOpen] = useState(false);

  const isLoading = goalLoading || blocksLoading || tracesLoading;
  const block = blocks?.find((b) => b.id === taskId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <Skeleton className="h-4 w-32 mb-6" />
          <Skeleton className="h-6 w-64 mb-2" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
        </main>
      </div>
    );
  }

  if (!goal || !block) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-muted-foreground">Block not found.</p>
          <Link to={missionId ? `/mission/${missionId}` : "/"} className="text-xs text-primary hover:underline mt-2 inline-block font-mono">← Back</Link>
        </main>
      </div>
    );
  }

  const status = block.status || "pending";
  const depBlocks = blocks?.filter((b) => block.dependencies.includes(b.id)) || [];
  const canComplete = status === "pending" || status === "active";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up">
          <Link to={`/mission/${missionId}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-6 font-mono">
            <ArrowLeft className="w-3 h-3" /> {goal.title}
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left panel — block details */}
          <div className="lg:col-span-2 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold leading-tight">{block.title}</h1>
              <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border", statusColor[status] || statusColor.pending)}>
                {statusLabel[status] || status}
              </span>
            </div>
            {block.description && <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{block.description}</p>}

            {/* Prerequisites */}
            {depBlocks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 font-mono">Prerequisites</h3>
                <div className="flex flex-wrap gap-1">
                  {depBlocks.map((dep) => (
                    <Link key={dep.id} to={`/mission/${missionId}/task/${dep.id}`}
                      className="inline-flex items-center px-2 py-0.5 bg-muted rounded text-xs font-mono hover:bg-accent transition-colors">
                      {dep.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-2">
              {canComplete && (
                <Button size="sm" onClick={() => {
                  updateBlock.mutate(
                    { id: block.id, goalId: goal.id, updates: { status: "complete" } },
                    { onError: (err: any) => toast.error(err.message) }
                  );
                }}>
                  Mark complete
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Delete block
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this block?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently remove the block and all its traces.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        deleteBlock.mutate(
                          { id: block.id, goalId: goal.id },
                          {
                            onSuccess: () => navigate(`/mission/${missionId}`),
                            onError: (err: any) => toast.error(err.message),
                          }
                        );
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Right panel — traces */}
          <div className="lg:col-span-3 animate-fade-in-up-delay-1">
            <div className="border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 font-mono">Trace log</h3>
                  <p className="text-xs text-muted-foreground">Chronological audit trail of actions on this block.</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddTraceOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> Add trace
                </Button>
              </div>

              {(!traces || traces.length === 0) ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No traces yet. Add one to start the audit log.</p>
              ) : (
                <div className="space-y-2">
                  {traces.map((trace) => (
                    <div key={trace.id} className={cn("border-l-4 rounded-r-lg bg-muted/30 px-4 py-3 group", actionColor[trace.action] || "border-l-muted-foreground")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs mb-1">
                            <span className="font-semibold">{trace.agent_name}</span>
                            <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono uppercase">{trace.action}</span>
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(trace.created_at), "MMM d, h:mm a")}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed">{trace.content}</p>
                        </div>
                        <button
                          onClick={() => deleteTrace.mutate({ id: trace.id, blockId: block.id }, { onError: (err: any) => toast.error(err.message) })}
                          className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <AddTraceDialog blockId={block.id} open={addTraceOpen} onOpenChange={setAddTraceOpen} />
      </main>
    </div>
  );
}

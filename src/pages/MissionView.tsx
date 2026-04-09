import { useParams, Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { Check, Lock, ArrowLeft, CheckCircle2, Plus, GripVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoal } from "@/hooks/use-goals";
import { useBlocks, useCreateBlock, useUpdateBlock, useDeleteBlock, BlockRow } from "@/hooks/use-blocks";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const statusBg: Record<string, string> = {
  complete: "bg-muted/60 border-substrate-complete/40",
  active: "bg-substrate-active/8 border-substrate-active/30",
  pending: "bg-substrate-open/8 border-substrate-open/30",
  stalled: "bg-substrate-blocked/8 border-substrate-blocked/30",
};

const statusAccent: Record<string, string> = {
  complete: "bg-substrate-complete",
  active: "bg-substrate-active",
  pending: "bg-substrate-open",
  stalled: "bg-substrate-blocked",
};

function BlockCard({
  block,
  goalId,
  onComplete,
}: {
  block: BlockRow;
  goalId: string;
  onComplete: (id: string) => void;
}) {
  const canComplete = block.status === "active" || block.status === "pending";
  const status = block.status || "pending";

  return (
    <div className="relative group w-48 shrink-0">
      <Link
        to={`/mission/${goalId}/task/${block.id}`}
        className={cn(
          "relative border-2 rounded-lg px-4 py-3 transition-all block",
          statusBg[status] || statusBg.pending,
          "hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        )}
      >
        <div className={cn("absolute top-0 left-3 right-3 h-0.5 rounded-b", statusAccent[status] || statusAccent.pending)} />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-50 cursor-grab">
          <GripVertical className="w-3 h-3" />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <div
            className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
              status === "complete" && "bg-primary border-primary",
              status === "pending" && "border-substrate-open bg-substrate-open/10",
              status === "active" && "border-substrate-active bg-substrate-active/10",
              status === "stalled" && "border-substrate-blocked bg-substrate-blocked/10"
            )}
          >
            {status === "complete" && <Check className="w-3 h-3 text-primary-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold leading-tight">{block.title}</span>
            {block.description && (
              <span className="text-[10px] text-muted-foreground leading-tight block mt-0.5 font-mono truncate">
                {block.description}
              </span>
            )}
          </div>
        </div>
      </Link>
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {canComplete && (
          <button
            onClick={(e) => { e.stopPropagation(); onComplete(block.id); }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-substrate-open text-[10px] font-medium text-primary-foreground shadow-sm hover:bg-substrate-open/80 transition-colors"
            title="Mark complete"
          >
            <CheckCircle2 className="w-3 h-3" /> Done
          </button>
        )}
      </div>
    </div>
  );
}

function AddBlockDialog({ goalId }: { goalId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createBlock = useCreateBlock();

  const handleCreate = () => {
    if (!title.trim()) return;
    createBlock.mutate(
      { goal_id: goalId, title: title.trim(), description: description.trim() || undefined },
      { onSuccess: () => { setTitle(""); setDescription(""); setOpen(false); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5" /> Add block
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Add a new block</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Block title" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
          <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm min-h-[60px]" />
        </div>
        <DialogFooter>
          <Button size="sm" onClick={handleCreate} disabled={!title.trim() || createBlock.isPending}>
            {createBlock.isPending ? "Creating..." : "Create block"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MissionView() {
  const { missionId } = useParams<{ missionId: string }>();
  const { data: goal, isLoading: goalLoading } = useGoal(missionId || "");
  const { data: blocks, isLoading: blocksLoading } = useBlocks(missionId || "");
  const updateBlock = useUpdateBlock();

  const isLoading = goalLoading || blocksLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <Skeleton className="h-6 w-64 mb-2" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="flex gap-3 flex-wrap">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="w-48 h-20 rounded-lg" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-muted-foreground">Mission not found.</p>
        </main>
      </div>
    );
  }

  const completeCount = blocks?.filter((b) => b.status === "complete").length || 0;
  const total = blocks?.length || 0;
  const pct = total > 0 ? Math.round((completeCount / total) * 100) : 0;

  const handleComplete = (blockId: string) => {
    updateBlock.mutate({ id: blockId, goalId: goal.id, updates: { status: "complete" } });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-6 font-mono">
            <ArrowLeft className="w-3 h-3" /> Missions
          </Link>
          <h1 className="text-2xl font-semibold leading-tight">{goal.title}</h1>
          {goal.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{goal.description}</p>}
          <div className="flex items-center gap-3 mt-4">
            <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums font-mono">{pct}% complete</span>
          </div>
        </div>

        <div className="mt-10 animate-fade-in-up-delay-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Blocks</h2>
            <AddBlockDialog goalId={goal.id} />
          </div>

          <div className="flex flex-wrap gap-4">
            {blocks?.map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                goalId={goal.id}
                onComplete={handleComplete}
              />
            ))}
            {blocks?.length === 0 && (
              <p className="text-muted-foreground text-sm">No blocks yet. Add one to get started.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

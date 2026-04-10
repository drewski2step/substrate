import { useParams, Link, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { cn } from "@/lib/utils";
import { Check, ArrowLeft, CheckCircle2, Plus, GripVertical, GitBranch } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGoal } from "@/hooks/use-goals";
import { useBlocks, useCreateBlock, useUpdateBlock, useSetDependencies, BlockWithDeps } from "@/hooks/use-blocks";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

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

// --- DAG helpers ---
function computeDepths(blocks: BlockWithDeps[]): Map<string, number> {
  const depths = new Map<string, number>();
  const blockMap = new Map(blocks.map((b) => [b.id, b]));
  function getDepth(id: string): number {
    if (depths.has(id)) return depths.get(id)!;
    const block = blockMap.get(id);
    if (!block || block.dependencies.length === 0) { depths.set(id, 0); return 0; }
    const d = Math.max(...block.dependencies.map((dep) => getDepth(dep))) + 1;
    depths.set(id, d);
    return d;
  }
  blocks.forEach((b) => getDepth(b.id));
  return depths;
}

function buildTiers(blocks: BlockWithDeps[]): BlockWithDeps[][] {
  const depths = computeDepths(blocks);
  const maxDepth = Math.max(0, ...Array.from(depths.values()));
  const tiers: BlockWithDeps[][] = Array.from({ length: maxDepth + 1 }, () => []);
  blocks.forEach((b) => tiers[depths.get(b.id) ?? 0].push(b));
  return tiers;
}

// --- Block card ---
function BlockCard({
  block, goalId, allBlocks, onComplete, onAddSuccessor, onEditDeps, onNavigate,
}: {
  block: BlockWithDeps; goalId: string; allBlocks: BlockWithDeps[];
  onComplete: (id: string) => void;
  onAddSuccessor: (block: BlockWithDeps) => void;
  onEditDeps: (block: BlockWithDeps) => void;
  onNavigate: (block: BlockWithDeps) => void;
}) {
  const canComplete = block.status === "active" || block.status === "pending";
  const status = block.status || "pending";
  return (
    <div className="relative group w-48 shrink-0">
      <div
        onClick={() => onNavigate(block)}
        className={cn(
          "relative border-2 rounded-lg px-4 py-3 transition-all cursor-pointer",
          statusBg[status] || statusBg.pending,
          "hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.02]"
        )}
      >
        <div className={cn("absolute top-0 left-3 right-3 h-0.5 rounded-b", statusAccent[status] || statusAccent.pending)} />
        <div className="flex items-center gap-2 pt-1">
          <div className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
            status === "complete" && "bg-primary border-primary",
            status === "pending" && "border-substrate-open bg-substrate-open/10",
            status === "active" && "border-substrate-active bg-substrate-active/10",
            status === "stalled" && "border-substrate-blocked bg-substrate-blocked/10"
          )}>
            {status === "complete" && <Check className="w-3 h-3 text-primary-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold leading-tight">{block.title}</span>
            {block.description && (
              <span className="text-[10px] text-muted-foreground leading-tight block mt-0.5 font-mono truncate">
                {block.description}
              </span>
            )}
            {block.dependencies.length > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {block.dependencies.length} prerequisite{block.dependencies.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {canComplete && (
          <button onClick={(e) => { e.stopPropagation(); onComplete(block.id); }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-substrate-open text-[10px] font-medium text-primary-foreground shadow-sm hover:bg-substrate-open/80 transition-colors"
          ><CheckCircle2 className="w-3 h-3" /> Done</button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onAddSuccessor(block); }}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-accent text-[10px] font-medium text-accent-foreground shadow-sm hover:bg-accent/80 transition-colors"
        ><Plus className="w-3 h-3" /> Next</button>
        <button onClick={(e) => { e.stopPropagation(); onEditDeps(block); }}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-foreground shadow-sm hover:bg-muted/80 transition-colors"
        ><GitBranch className="w-3 h-3" /> Deps</button>
      </div>
    </div>
  );
}

// --- SVG connectors ---
function TierConnectors({ tierAbove, tierBelow }: { tierAbove: BlockWithDeps[]; tierBelow: BlockWithDeps[] }) {
  const lines: { fromIdx: number; toIdx: number; fromCount: number; toCount: number; complete: boolean }[] = [];
  tierAbove.forEach((block, fromIdx) => {
    block.dependencies.forEach((depId) => {
      const toIdx = tierBelow.findIndex((b) => b.id === depId);
      if (toIdx !== -1) {
        lines.push({ fromIdx, toIdx, fromCount: tierAbove.length, toCount: tierBelow.length, complete: tierBelow[toIdx].status === "complete" });
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

// --- Add Block / Successor dialog ---
function AddBlockDialog({ goalId, parentBlock, open, onOpenChange }: {
  goalId: string; parentBlock?: BlockWithDeps | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createBlock = useCreateBlock();

  const handleCreate = () => {
    if (!title.trim()) return;
    createBlock.mutate(
      { goal_id: goalId, title: title.trim(), description: description.trim() || undefined, dependsOnId: parentBlock?.id },
      {
        onSuccess: () => { setTitle(""); setDescription(""); onOpenChange(false); },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setTitle(""); setDescription(""); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {parentBlock ? `Add successor to "${parentBlock.title}"` : "Add a new block"}
          </DialogTitle>
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

// --- Edit deps dialog ---
function EditDepsDialog({ block, allBlocks, goalId, open, onOpenChange }: {
  block: BlockWithDeps; allBlocks: BlockWithDeps[]; goalId: string; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(block.dependencies));
  const setDeps = useSetDependencies();
  const others = allBlocks.filter((b) => b.id !== block.id);

  const handleSave = () => {
    setDeps.mutate(
      { blockId: block.id, goalId, dependsOnIds: Array.from(selected) },
      { onSuccess: () => onOpenChange(false), onError: (err: any) => toast.error(err.message) }
    );
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Edit prerequisites for "{block.title}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {others.length === 0 && <p className="text-xs text-muted-foreground">No other blocks to depend on.</p>}
          {others.map((b) => (
            <label key={b.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-muted/50">
              <Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggle(b.id)} />
              <span className="text-xs">{b.title}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button size="sm" onClick={handleSave} disabled={setDeps.isPending}>
            {setDeps.isPending ? "Saving..." : "Save dependencies"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main page ---
export default function MissionView() {
  const { missionId } = useParams<{ missionId: string }>();
  const { data: goal, isLoading: goalLoading } = useGoal(missionId || "");
  const { data: blocks, isLoading: blocksLoading } = useBlocks(missionId || "");
  const updateBlock = useUpdateBlock();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [successorParent, setSuccessorParent] = useState<BlockWithDeps | null>(null);
  const [editDepsBlock, setEditDepsBlock] = useState<BlockWithDeps | null>(null);

  const tiers = useMemo(() => (blocks ? buildTiers(blocks) : []), [blocks]);
  const reversedTiers = useMemo(() => [...tiers].reverse(), [tiers]);
  const isLoading = goalLoading || blocksLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <Skeleton className="h-6 w-64 mb-2" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="flex gap-3 flex-wrap">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="w-48 h-20 rounded-lg" />)}
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
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Block flow</h2>
            <Button size="sm" className="gap-1.5" onClick={() => { setSuccessorParent(null); setAddDialogOpen(true); }}>
              <Plus className="w-3.5 h-3.5" /> Add block
            </Button>
          </div>

          {blocks?.length === 0 ? (
            <p className="text-muted-foreground text-sm">No blocks yet. Add one to get started.</p>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex flex-col items-center gap-0 min-w-fit">
                {reversedTiers.map((tier, tierIdx) => {
                  const nextTierBelow = tierIdx < reversedTiers.length - 1 ? reversedTiers[tierIdx + 1] : null;
                  return (
                    <div key={tierIdx} className="flex flex-col items-center">
                      <div className="flex items-start justify-center gap-3">
                        {tier.map((block) => (
                          <BlockCard
                            key={block.id} block={block} goalId={goal.id} allBlocks={blocks || []}
                            onComplete={(id) => updateBlock.mutate({ id, goalId: goal.id, updates: { status: "complete" } })}
                            onAddSuccessor={(b) => { setSuccessorParent(b); setAddDialogOpen(true); }}
                            onEditDeps={setEditDepsBlock}
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
                <div className="mt-3 px-3 py-1 bg-muted rounded text-xs text-muted-foreground font-medium font-mono">Foundation</div>
              </div>
            </div>
          )}
        </div>

        <AddBlockDialog goalId={goal.id} parentBlock={successorParent} open={addDialogOpen} onOpenChange={setAddDialogOpen} />
        {editDepsBlock && (
          <EditDepsDialog
            block={editDepsBlock} allBlocks={blocks || []} goalId={goal.id}
            open={!!editDepsBlock} onOpenChange={(o) => { if (!o) setEditDepsBlock(null); }}
          />
        )}
      </main>
    </div>
  );
}

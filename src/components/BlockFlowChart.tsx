import { useMemo, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, CheckCircle2, Plus, GitBranch, Flame, AlertTriangle, HelpCircle, FolderOpen, Pencil, Trash2, Star, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useBlocks, useCreateBlock, useUpdateBlock, useDeleteBlock, useSetDependencies, useUpdateBlockPosition, BlockWithDeps } from "@/hooks/use-blocks";
import { useBlockDiscussionCounts } from "@/hooks/use-discussions";
import { useLogEdit } from "@/hooks/use-edit-history";
import { useAuth } from "@/hooks/use-auth";
import { useBlockPledges, usePledgeBlock, useUnpledgeBlock } from "@/hooks/use-pledges";
import { DocumentPanel } from "@/components/DocumentPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function getHeatColor(heat: number): string {
  if (heat <= 0) return "border-border bg-card";
  if (heat <= 20) return "border-blue-300 bg-blue-50";
  if (heat <= 50) return "border-teal-300 bg-teal-50";
  if (heat <= 100) return "border-yellow-400 bg-yellow-50";
  if (heat <= 150) return "border-orange-400 bg-orange-50";
  if (heat < 200) return "border-red-500 bg-red-50";
  return "border-red-500 bg-red-50 animate-flame-rim";
}

function getFlameColor(heat: number): string {
  if (heat <= 0) return "text-muted-foreground";
  if (heat <= 20) return "text-blue-500";
  if (heat <= 50) return "text-teal-500";
  if (heat <= 100) return "text-yellow-500";
  if (heat <= 150) return "text-orange-500";
  return "text-red-500";
}

const BLOCK_W = 192; // w-48 = 12rem = 192px
const BLOCK_H = 80;
const GAP_X = 24;
const GAP_Y = 24;
const COLS = 3;

/** Compute grid positions for auto-laid blocks (no saved position). Sorted by created_at ascending. */
function computeGridPositions(autoBlocks: BlockWithDeps[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const sorted = [...autoBlocks].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTime - bTime;
  });
  sorted.forEach((block, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    positions.set(block.id, {
      x: col * (BLOCK_W + GAP_X),
      y: row * (BLOCK_H + GAP_Y),
    });
  });
  return positions;
}

// --- Block card with heat ---
function BlockCard({
  block, posX, posY, onComplete, onAddSuccessor, onEditDeps, onNavigate, onEdit, onDragEnd,
}: {
  block: BlockWithDeps;
  posX: number;
  posY: number;
  onComplete: (id: string) => void;
  onAddSuccessor: (block: BlockWithDeps) => void;
  onEditDeps: (block: BlockWithDeps) => void;
  onNavigate: (block: BlockWithDeps) => void;
  onEdit: (block: BlockWithDeps) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
}) {
  const didDragRef = useRef(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const canComplete = block.status === "active" || block.status === "pending";
  const status = block.status || "pending";
  const heat = block.heat || 0;
  const { data: counts } = useBlockDiscussionCounts(block.id);
  const { data: pledges } = useBlockPledges(block.id);
  const pledgeBlock = usePledgeBlock();
  const unpledgeBlock = useUnpledgeBlock();
  const { user } = useAuth();

  // Fetch pledger usernames
  const pledgerIds = pledges?.map((p) => p.user_id) || [];
  const { data: pledgerProfiles } = useQuery({
    queryKey: ["pledger-profiles", block.id, pledgerIds.join(",")],
    queryFn: async () => {
      if (pledgerIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, username, avatar_seed").in("id", pledgerIds);
      return data || [];
    },
    enabled: pledgerIds.length > 0,
  });

  const isPledged = pledges && pledges.length > 0;
  const userPledged = pledges?.some((p) => p.user_id === user?.id);

  // Generate star positions for night sky
  const stars = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      left: `${Math.random() * 90 + 5}%`,
      top: `${Math.random() * 80 + 5}%`,
      delay: `${Math.random() * 3}s`,
      duration: `${1.5 + Math.random() * 1.5}s`,
    })),
  []);

  const handleGripMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    didDragRef.current = false;
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didDragRef.current = true;
      }
      setDragOffset({ x: dx, y: dy });
    };
    const handleMouseUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (didDragRef.current && onDragEnd) {
        onDragEnd(block.id, Math.max(0, posX + dx), Math.max(0, posY + dy));
      }
      setDragOffset(null);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [block.id, posX, posY, onDragEnd]);

  const left = posX + (dragOffset?.x || 0);
  const top = posY + (dragOffset?.y || 0);

  return (
    <div
      className="absolute group"
      style={{
        left, top,
        width: BLOCK_W,
        zIndex: dragOffset ? 50 : 1,
        transition: dragOffset ? 'none' : 'left 0.2s ease, top 0.2s ease',
      }}
    >
      <div
        onClick={() => { if (!didDragRef.current) onNavigate(block); }}
        className={cn(
          "relative border-2 rounded-lg px-4 py-3 cursor-pointer overflow-hidden",
          isPledged ? "border-indigo-400/60 bg-[hsl(230,35%,12%)]" : getHeatColor(heat),
          counts?.openBlockers && counts.openBlockers > 0 && "ring-2 ring-destructive/50",
          heat >= 200 && !isPledged && "animate-flame-rim",
          "hover:shadow-lg"
        )}
      >
        {/* Drag handle — top right */}
        <div
          onMouseDown={handleGripMouseDown}
          className="absolute top-1.5 right-1.5 cursor-grab active:cursor-grabbing p-0.5 z-20"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/50" />
        </div>

        {/* Night sky stars for pledged blocks */}
        {isPledged && stars.map((s, i) => (
          <span
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white animate-twinkle"
            style={{ left: s.left, top: s.top, animationDelay: s.delay, animationDuration: s.duration }}
          />
        ))}

        <div className={cn("flex items-center gap-2 pt-1 pr-5 relative z-10", isPledged && "text-indigo-100")}>
          <div className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
            status === "complete" && "bg-primary border-primary",
            status === "pending" && (isPledged ? "border-indigo-400/50 bg-indigo-400/10" : "border-muted-foreground/30 bg-muted/30"),
            status === "active" && "border-substrate-active bg-substrate-active/10",
            status === "stalled" && "border-substrate-blocked bg-substrate-blocked/10"
          )}>
            {status === "complete" && <Check className="w-3 h-3 text-primary-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <span className={cn("text-xs font-semibold leading-tight", isPledged && "text-indigo-50")}>{block.title}</span>
            {block.description && (
              <span className={cn("text-[10px] leading-tight block mt-0.5 font-mono truncate", isPledged ? "text-indigo-300/70" : "text-muted-foreground")}>
                {block.description}
              </span>
            )}
          </div>
        </div>

        {/* Pledger avatars */}
        {isPledged && pledgerProfiles && pledgerProfiles.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 relative z-10">
            {pledgerProfiles.slice(0, 5).map((p) => (
              <div key={p.id} className="group/avatar relative">
                <img
                  src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${p.avatar_seed}`}
                  alt={p.username}
                  className="w-5 h-5 rounded-full border border-indigo-400/40 hover:scale-125 transition-transform"
                />
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover/avatar:opacity-100 whitespace-nowrap pointer-events-none">
                  {p.username}
                </span>
              </div>
            ))}
            {pledgerProfiles.length > 5 && (
              <span className="text-[10px] text-indigo-300">+{pledgerProfiles.length - 5}</span>
            )}
          </div>
        )}

        {/* Heat + discussion badges */}
        <div className={cn("flex items-center gap-2 mt-1.5 flex-wrap relative z-10", isPledged && "text-indigo-300")}>
          {heat > 0 && (
            <span className={cn("flex items-center gap-0.5 text-[10px] font-mono tabular-nums", isPledged ? "text-amber-300" : getFlameColor(heat))}>
              <Flame className="w-3 h-3" />{heat}
            </span>
          )}
          {counts?.openQuestions && counts.openQuestions > 0 ? (
            <span className="flex items-center gap-0.5 text-[10px] text-blue-400 font-mono">
              <HelpCircle className="w-3 h-3" />{counts.openQuestions}
            </span>
          ) : null}
          {counts?.openBlockers && counts.openBlockers > 0 ? (
            <span className="flex items-center gap-0.5 text-[10px] text-red-400 font-mono">
              <AlertTriangle className="w-3 h-3" />{counts.openBlockers}
            </span>
          ) : null}
          {block.dependencies.length > 0 && (
            <span className="text-[10px] font-mono">
              {block.dependencies.length} dep{block.dependencies.length > 1 ? "s" : ""}
            </span>
          )}
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
        <button onClick={(e) => { e.stopPropagation(); onEdit(block); }}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-foreground shadow-sm hover:bg-muted/80 transition-colors"
        ><Pencil className="w-3 h-3" /> Edit</button>
        {user && (
          <button onClick={(e) => {
            e.stopPropagation();
            if (userPledged) unpledgeBlock.mutate({ blockId: block.id, userId: user.id });
            else pledgeBlock.mutate({ blockId: block.id, userId: user.id });
          }}
            className={cn("flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shadow-sm transition-colors",
              userPledged ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
            )}
          ><Star className="w-3 h-3" /> {userPledged ? "Pledged" : "Pledge"}</button>
        )}
      </div>
    </div>
  );
}

// --- SVG connectors using absolute positions ---
function AbsoluteConnectors({
  blocks,
  positions,
  dragOffsets,
}: {
  blocks: BlockWithDeps[];
  positions: Map<string, { x: number; y: number }>;
  dragOffsets: Map<string, { x: number; y: number }>;
}) {
  const blockMap = new Map(blocks.map((b) => [b.id, b]));
  const lines: { fromX: number; fromY: number; toX: number; toY: number; complete: boolean }[] = [];

  blocks.forEach((block) => {
    const fromPos = positions.get(block.id);
    if (!fromPos) return;
    const fromOffset = dragOffsets.get(block.id);
    const fromCenterX = fromPos.x + (fromOffset?.x || 0) + BLOCK_W / 2;
    const fromTopY = fromPos.y + (fromOffset?.y || 0);

    block.dependencies.forEach((depId) => {
      const toPos = positions.get(depId);
      if (!toPos) return;
      const dep = blockMap.get(depId);
      const toOffset = dragOffsets.get(depId);
      const toCenterX = toPos.x + (toOffset?.x || 0) + BLOCK_W / 2;
      const toBottomY = toPos.y + (toOffset?.y || 0) + BLOCK_H;

      lines.push({
        fromX: fromCenterX,
        fromY: fromTopY,
        toX: toCenterX,
        toY: toBottomY,
        complete: dep?.status === "complete",
      });
    });
  });

  if (lines.length === 0) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: 0 }}>
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.fromX} y1={line.fromY}
          x2={line.toX} y2={line.toY}
          stroke={line.complete ? "hsl(var(--substrate-complete))" : "hsl(var(--border))"}
          strokeWidth={line.complete ? 2 : 1.5}
          strokeDasharray={line.complete ? undefined : "4 3"}
        />
      ))}
    </svg>
  );
}

// --- Add Block dialog ---
function AddBlockDialog({ goalId, parentBlockId, dependsOnBlock, open, onOpenChange }: {
  goalId: string; parentBlockId?: string | null; dependsOnBlock?: BlockWithDeps | null; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createBlock = useCreateBlock();

  const handleCreate = () => {
    if (!title.trim()) return;
    createBlock.mutate(
      { goal_id: goalId, title: title.trim(), description: description.trim() || undefined, parent_block_id: parentBlockId || undefined, dependsOnId: dependsOnBlock?.id },
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
            {dependsOnBlock ? `Add successor to "${dependsOnBlock.title}"` : "Add a new block"}
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

// =============================================
// MAIN EXPORT: Universal BlockFlowChart
// =============================================
export function BlockFlowChart({
  goalId,
  parentBlockId,
  parentBlockTitle,
  onNavigateToBlock,
}: {
  goalId: string;
  parentBlockId?: string | null;
  parentBlockTitle?: string;
  onNavigateToBlock: (block: BlockWithDeps) => void;
}) {
  const { data: allGoalBlocks, isLoading } = useBlocks(goalId);
  const updateBlock = useUpdateBlock();
  const updatePosition = useUpdateBlockPosition();
  const deleteBlock = useDeleteBlock();
  const logEdit = useLogEdit();
  const { user } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [successorParent, setSuccessorParent] = useState<BlockWithDeps | null>(null);
  const [editDepsBlock, setEditDepsBlock] = useState<BlockWithDeps | null>(null);
  const [editBlock, setEditBlock] = useState<BlockWithDeps | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);

  // Find the real files block from DB
  const filesBlock = useMemo(() => {
    if (!allGoalBlocks || !parentBlockId) return null;
    return allGoalBlocks.find((b) => (b as any).is_files_block === true && b.parent_block_id === parentBlockId) || null;
  }, [allGoalBlocks, parentBlockId]);

  // Only show files shelf when we have a real parent block (not at goal level)
  const hasFilesBlock = !!parentBlockId;

  const blocks = useMemo(() => {
    if (!allGoalBlocks) return [];
    return allGoalBlocks.filter((b) => {
      // Always exclude files blocks from the flowchart
      if ((b as any).is_files_block) return false;
      if (parentBlockId) return b.parent_block_id === parentBlockId;
      return !b.parent_block_id;
    });
  }, [allGoalBlocks, parentBlockId]);

  // Compute positions: pinned blocks keep saved coords, auto-laid blocks use grid
  const positions = useMemo(() => {
    const pinned = blocks.filter((b) => b.position_x != null && b.position_y != null);
    const autoLaid = blocks.filter((b) => b.position_x == null || b.position_y == null);
    const gridPositions = computeGridPositions(autoLaid);
    const result = new Map<string, { x: number; y: number }>();
    pinned.forEach((b) => {
      result.set(b.id, { x: b.position_x!, y: b.position_y! });
    });
    autoLaid.forEach((b) => {
      const pos = gridPositions.get(b.id);
      result.set(b.id, pos || { x: 0, y: 0 });
    });
    return result;
  }, [blocks]);

  // Compute container height from positions (width is 100%)
  const containerHeight = useMemo(() => {
    let maxY = 0;
    positions.forEach((pos) => {
      maxY = Math.max(maxY, pos.y + BLOCK_H + 40);
    });
    return Math.max(200, maxY);
  }, [positions]);

  const filesBlockLabel = parentBlockTitle ? `${parentBlockTitle} Files` : "Files";
  const filesBlockId = filesBlock?.id || "";

  if (isLoading) {
    return (
      <div className="flex gap-3 flex-wrap">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="w-48 h-20 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Block flow</h2>
        <Button size="sm" className="gap-1.5" onClick={() => { setSuccessorParent(null); setAddDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5" /> Add block
        </Button>
      </div>

      {/* Files Block — only shown at block level, not goal level */}
      {hasFilesBlock && (
        <div
          onClick={() => {
            if (!filesBlockId) {
              toast.error("Files block not found — it may still be creating");
              return;
            }
            setFilesOpen(true);
          }}
          className="mb-4 w-full max-w-md mx-auto border-2 border-emerald-600/30 bg-emerald-900/10 rounded-lg px-4 py-2 cursor-pointer hover:bg-emerald-900/20 hover:border-emerald-500/40 transition-all flex items-center gap-2"
        >
          <FolderOpen className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-medium text-emerald-700">{filesBlockLabel}</span>
        </div>
      )}

      {blocks.length === 0 ? (
        <p className="text-muted-foreground text-sm">No blocks yet. Add one to get started.</p>
      ) : (
        <div className="overflow-x-hidden pb-4">
          <div className="relative w-full" style={{ height: containerHeight }}>
            <AbsoluteConnectors blocks={blocks} positions={positions} dragOffsets={new Map()} />
            {blocks.map((block) => {
              const pos = positions.get(block.id) || { x: 0, y: 0 };
              return (
                <BlockCard
                  key={block.id}
                  block={block}
                  posX={pos.x}
                  posY={pos.y}
                  onComplete={(id) => updateBlock.mutate({ id, goalId, updates: { status: "complete" } })}
                  onAddSuccessor={(b) => { setSuccessorParent(b); setAddDialogOpen(true); }}
                  onEditDeps={setEditDepsBlock}
                  onNavigate={onNavigateToBlock}
                  onEdit={(b) => user ? setEditBlock(b) : toast.error("Sign in to edit")}
                  onDragEnd={(id, x, y) => updatePosition.mutate({ id, goalId, position_x: x, position_y: y })}
                />
              );
            })}
          </div>
        </div>
      )}

      <AddBlockDialog goalId={goalId} parentBlockId={parentBlockId} dependsOnBlock={successorParent} open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      {editDepsBlock && (
        <EditDepsDialog
          block={editDepsBlock} allBlocks={blocks} goalId={goalId}
          open={!!editDepsBlock} onOpenChange={(o) => { if (!o) setEditDepsBlock(null); }}
        />
      )}

      {/* Document panel dialog */}
      <Dialog open={filesOpen} onOpenChange={setFilesOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-emerald-600" /> {filesBlockLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-[300px] overflow-hidden">
            <DocumentPanel blockId={filesBlockId} goalId={goalId} blockTitle={parentBlockTitle || "Goal"} parentBlockId={parentBlockId || undefined} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit block dialog */}
      {editBlock && (
        <EditBlockDialog
          block={editBlock} goalId={goalId}
          open={!!editBlock} onOpenChange={(o) => { if (!o) setEditBlock(null); }}
        />
      )}
    </div>
  );
}

// --- Edit Block dialog ---
function EditBlockDialog({ block, goalId, open, onOpenChange }: {
  block: BlockWithDeps; goalId: string; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [title, setTitle] = useState(block.title);
  const [description, setDescription] = useState(block.description || "");
  const [status, setStatus] = useState(block.status || "pending");
  const updateBlock = useUpdateBlock();
  const deleteBlock = useDeleteBlock();
  const logEdit = useLogEdit();
  const { user } = useAuth();

  const handleSave = async () => {
    if (!user || !title.trim()) return;
    const changes: { field: string; old: string | null; new_val: string | null }[] = [];
    if (title.trim() !== block.title) changes.push({ field: "title", old: block.title, new_val: title.trim() });
    if (description.trim() !== (block.description || "")) changes.push({ field: "description", old: block.description, new_val: description.trim() || null });
    if (status !== (block.status || "pending")) changes.push({ field: "status", old: block.status, new_val: status });

    for (const c of changes) {
      await logEdit.mutateAsync({ entity_type: "block", entity_id: block.id, changed_by: user.id, field_changed: c.field, old_value: c.old, new_value: c.new_val });
    }

    const updates: any = {};
    if (title.trim() !== block.title) updates.title = title.trim();
    if (description.trim() !== (block.description || "")) updates.description = description.trim() || null;
    if (status !== (block.status || "pending")) updates.status = status;

    if (Object.keys(updates).length > 0) {
      updateBlock.mutate({ id: block.id, goalId, updates }, {
        onSuccess: () => { onOpenChange(false); toast.success("Block updated"); },
        onError: (err: any) => toast.error(err.message),
      });
    } else {
      onOpenChange(false);
    }
  };

  const handleDelete = () => {
    if (!user) return;
    logEdit.mutate({ entity_type: "block", entity_id: block.id, changed_by: user.id, field_changed: "deleted_at", old_value: null, new_value: new Date().toISOString() });
    updateBlock.mutate({ id: block.id, goalId, updates: { deleted_at: new Date().toISOString() } as any }, {
      onSuccess: () => { onOpenChange(false); toast.success("Block deleted. Undo within 24 hours from block view."); },
      onError: (err: any) => toast.error(err.message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setTitle(block.title); setDescription(block.description || ""); setStatus(block.status || "pending"); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Edit block</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
          <Textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm min-h-[60px]" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
              <SelectItem value="stalled">Stalled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="flex justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this block?</AlertDialogTitle>
                <AlertDialogDescription>Are you sure you want to delete this block and all its contents? This can be undone within 24 hours.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button size="sm" onClick={handleSave} disabled={!title.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Check, CheckCircle2, Plus, GitBranch, Flame, AlertTriangle, HelpCircle, FolderOpen, Pencil, Trash2, Star, GripVertical, Undo2, Clock, Calendar, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useBlocks, useCreateBlock, useUpdateBlock, useDeleteBlock, useSetDependencies, useUpdateBlockPosition, useUpdateBlockSize, BlockWithDeps, pickUtahColor } from "@/hooks/use-blocks";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

const DEFAULT_BLOCK_W = 192;
const DEFAULT_BLOCK_H = 80;
const MIN_BLOCK_W = 140;
const MIN_BLOCK_H = 60;
// Resize bounds (per spec)
const RESIZE_MIN_W = 160;
const RESIZE_MIN_H = 80;
const RESIZE_MAX_W = 480;
const RESIZE_MAX_H = 400;
const BLOCK_W = DEFAULT_BLOCK_W;
const BLOCK_H = DEFAULT_BLOCK_H;
const GAP_X = 24;
const GAP_Y = 24;
const COLS = 3;
const EXPAND_THRESHOLD = 80;
const EXPAND_AMOUNT = 40;

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

/**
 * Batch-save position updates for multiple blocks.
 * TODO: Replace individual updates with a batch upsert when block counts grow large.
 */
async function batchSavePositions(
  blockPositions: { id: string; position_x: number; position_y: number }[],
) {
  for (const bp of blockPositions) {
    await supabase
      .from("blocks")
      .update({ position_x: bp.position_x, position_y: bp.position_y } as any)
      .eq("id", bp.id);
  }
}

// --- Block card with heat ---
function BlockCard({
  block, posX, posY, onComplete, onAddSuccessor, onEditDeps, onNavigate, onEdit, onDragEnd,
  onDragNearEdge, canvasWidth, canvasHeight, creatorName, creatorAvatarSeed, isAnimatingOut,
}: {
  block: BlockWithDeps;
  posX: number;
  posY: number;
  creatorName?: string;
  creatorAvatarSeed?: string;
  isAnimatingOut?: boolean;
  onComplete: (id: string) => void;
  onAddSuccessor: (block: BlockWithDeps) => void;
  onEditDeps: (block: BlockWithDeps) => void;
  onNavigate: (block: BlockWithDeps) => void;
  onEdit: (block: BlockWithDeps) => void;
  onDragEnd?: (id: string, x: number, y: number) => void;
  onDragNearEdge?: (id: string, direction: 'up' | 'down' | 'left' | 'right') => void;
  canvasWidth?: number;
  canvasHeight?: number;
}) {
  const didDragRef = useRef(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const canComplete = block.status === "active" || block.status === "pending";
  const isComplete = block.status === "complete";
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

      // Check proximity to canvas edges for expansion
      if (onDragNearEdge && canvasWidth && canvasHeight) {
        const projX = posX + dx;
        const projY = posY + dy;
        if (projY < EXPAND_THRESHOLD) onDragNearEdge(block.id, 'up');
        if (projY + BLOCK_H > canvasHeight - EXPAND_THRESHOLD) onDragNearEdge(block.id, 'down');
        if (projX < EXPAND_THRESHOLD) onDragNearEdge(block.id, 'left');
        if (projX + BLOCK_W > canvasWidth - EXPAND_THRESHOLD) onDragNearEdge(block.id, 'right');
      }
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
  }, [block.id, posX, posY, onDragEnd, onDragNearEdge, canvasWidth, canvasHeight]);

  return (
    <div
      className="absolute group"
      onMouseDown={() => { didDragRef.current = false; }}
      style={{
        left: posX, top: posY,
        transform: dragOffset ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined,
        width: BLOCK_W,
        zIndex: dragOffset ? 50 : 1,
        transition: dragOffset ? 'none' : 'left 0.2s ease, top 0.2s ease, transform 0.2s ease',
        willChange: dragOffset ? 'transform' : undefined,
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
            {creatorAvatarSeed && (
              <div className="flex items-center gap-1 mt-0.5">
                <div className="group/creator relative">
                  <img
                    src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${creatorAvatarSeed}`}
                    alt={creatorName || "creator"}
                    className="w-4 h-4 rounded-full border border-border/50"
                  />
                  {creatorName && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover/creator:opacity-100 whitespace-nowrap pointer-events-none z-30">
                      {creatorName}
                    </span>
                  )}
                </div>
                {creatorName && (
                  <span className={cn("text-[9px] leading-tight font-mono", isPledged ? "text-indigo-400/60" : "text-muted-foreground/60")}>
                    {creatorName}
                  </span>
                )}
              </div>
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
          {/* Deadline badge */}
          {(block as any).deadline_at && (
            <span className={cn("flex items-center gap-0.5 text-[10px] font-mono tabular-nums",
              new Date((block as any).deadline_at) < new Date() ? "text-red-500" : isPledged ? "text-indigo-300" : "text-muted-foreground"
            )}>
              <Calendar className="w-3 h-3" />
              {new Date((block as any).deadline_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          )}
          {/* Recurrence badge */}
          {(block as any).recurrence_interval && (
            <span className={cn("flex items-center gap-0.5 text-[10px] font-mono", isPledged ? "text-indigo-300" : "text-muted-foreground")}>
              <Clock className="w-3 h-3" />{(block as any).recurrence_interval}
            </span>
          )}
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
        {isComplete && (
          <button onClick={(e) => { e.stopPropagation(); onComplete(block.id); }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-foreground shadow-sm hover:bg-muted/80 transition-colors"
          ><Undo2 className="w-3 h-3" /> Reopen</button>
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

// --- SVG connectors with arrowheads ---
function AbsoluteConnectors({
  blocks,
  positions,
  dragOffsets,
  blockSizes,
}: {
  blocks: BlockWithDeps[];
  positions: Map<string, { x: number; y: number }>;
  dragOffsets: Map<string, { x: number; y: number }>;
  blockSizes?: Map<string, { w: number; h: number }>;
}) {
  const blockMap = new Map(blocks.map((b) => [b.id, b]));
  const lines: { fromX: number; fromY: number; toX: number; toY: number; complete: boolean }[] = [];

  blocks.forEach((block) => {
    const fromPos = positions.get(block.id);
    if (!fromPos) return;
    const fromOffset = dragOffsets.get(block.id);
    const fromSize = blockSizes?.get(block.id) || { w: BLOCK_W, h: BLOCK_H };
    const fromCenterX = fromPos.x + (fromOffset?.x || 0) + fromSize.w / 2;
    const fromTopY = fromPos.y + (fromOffset?.y || 0);

    block.dependencies.forEach((depId) => {
      const toPos = positions.get(depId);
      if (!toPos) return;
      const dep = blockMap.get(depId);
      const toOffset = dragOffsets.get(depId);
      const toSize = blockSizes?.get(depId) || { w: BLOCK_W, h: BLOCK_H };
      const toCenterX = toPos.x + (toOffset?.x || 0) + toSize.w / 2;
      const toBottomY = toPos.y + (toOffset?.y || 0) + toSize.h;

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
      <defs>
        <marker id="arrow-default" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L8,3 Z" fill="hsl(var(--border))" />
        </marker>
        <marker id="arrow-complete" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L8,3 Z" fill="hsl(var(--substrate-complete))" />
        </marker>
      </defs>
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.toX} y1={line.toY}
          x2={line.fromX} y2={line.fromY}
          stroke={line.complete ? "hsl(var(--substrate-complete))" : "hsl(var(--border))"}
          strokeWidth={line.complete ? 2 : 1.5}
          strokeDasharray={line.complete ? undefined : "4 3"}
          markerEnd={line.complete ? "url(#arrow-complete)" : "url(#arrow-default)"}
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
  const [deadlineAt, setDeadlineAt] = useState("");
  const createBlock = useCreateBlock();
  const { user } = useAuth();

  const handleCreate = () => {
    if (!title.trim()) return;
    createBlock.mutate(
      { goal_id: goalId, title: title.trim(), description: description.trim() || undefined, parent_block_id: parentBlockId || undefined, dependsOnId: dependsOnBlock?.id, created_by: user?.id, deadline_at: deadlineAt || undefined },
      {
        onSuccess: () => { setTitle(""); setDescription(""); setDeadlineAt(""); onOpenChange(false); },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setTitle(""); setDescription(""); setDeadlineAt(""); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {dependsOnBlock ? `Add successor to "${dependsOnBlock.title}"` : "Add a new block"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Block title" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
          <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm min-h-[60px]" />
          <div>
            <label className="text-xs text-muted-foreground font-medium flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3" /> Deadline (optional)
            </label>
            <Input type="datetime-local" value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)} className="text-sm" />
          </div>
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
  const [animatingOutId, setAnimatingOutId] = useState<string | null>(null);

  // Canvas expansion state
  const [canvasExtra, setCanvasExtra] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const lastExpandRef = useRef(0);

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
      if ((b as any).is_files_block) return false;
      if (parentBlockId) return b.parent_block_id === parentBlockId;
      return !b.parent_block_id;
    });
  }, [allGoalBlocks, parentBlockId]);

  // Partition: completed bricks vs active blocks (active includes the one currently animating out)
  const completedBricks = useMemo(
    () => blocks
      .filter((b) => b.status === "complete" && b.id !== animatingOutId)
      .sort((a, b) => {
        const at = (a as any).completed_at ? new Date((a as any).completed_at).getTime() : 0;
        const bt = (b as any).completed_at ? new Date((b as any).completed_at).getTime() : 0;
        return at - bt;
      }),
    [blocks, animatingOutId]
  );
  const activeBlocks = useMemo(
    () => blocks.filter((b) => b.status !== "complete" || b.id === animatingOutId),
    [blocks, animatingOutId]
  );

  // Batch-fetch profiles for creators AND completers
  const profileIds = useMemo(() => {
    const ids = new Set<string>();
    blocks.forEach((b) => {
      if (b.created_by) ids.add(b.created_by);
      if ((b as any).completed_by) ids.add((b as any).completed_by);
    });
    return Array.from(ids);
  }, [blocks]);
  const { data: creatorProfiles } = useQuery({
    queryKey: ["block-creator-profiles", profileIds.join(",")],
    queryFn: async () => {
      if (profileIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, username, avatar_seed").in("id", profileIds);
      return data || [];
    },
    enabled: profileIds.length > 0,
  });
  const creatorMap = useMemo(() => {
    const map = new Map<string, { username: string; avatar_seed: string }>();
    creatorProfiles?.forEach((p) => map.set(p.id, { username: p.username, avatar_seed: p.avatar_seed }));
    return map;
  }, [creatorProfiles]);

  // Compute positions for ACTIVE blocks only (completed blocks live in the brick strip)
  const positions = useMemo(() => {
    const pinned = activeBlocks.filter((b) => b.position_x != null && b.position_y != null);
    const autoLaid = activeBlocks.filter((b) => b.position_x == null || b.position_y == null);
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
  }, [activeBlocks]);

  // Compute container dimensions from positions + canvas extra
  const { containerWidth, containerHeight } = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    positions.forEach((pos) => {
      maxX = Math.max(maxX, pos.x + BLOCK_W + 40);
      maxY = Math.max(maxY, pos.y + BLOCK_H + 40);
    });
    return {
      containerWidth: Math.max(COLS * (BLOCK_W + GAP_X), maxX) + canvasExtra.right + canvasExtra.left,
      containerHeight: Math.max(200, maxY) + canvasExtra.bottom + canvasExtra.top,
    };
  }, [positions, canvasExtra]);

  // Handle canvas expansion when a block is dragged near an edge
  const handleDragNearEdge = useCallback((blockId: string, direction: 'up' | 'down' | 'left' | 'right') => {
    const now = Date.now();
    if (now - lastExpandRef.current < 500) return;
    lastExpandRef.current = now;

    if (direction === 'down') {
      setCanvasExtra((prev) => ({ ...prev, bottom: prev.bottom + EXPAND_AMOUNT }));
    } else if (direction === 'right') {
      setCanvasExtra((prev) => ({ ...prev, right: prev.right + EXPAND_AMOUNT }));
    } else if (direction === 'up') {
      // Shift all block positions down by EXPAND_AMOUNT
      setCanvasExtra((prev) => ({ ...prev, top: prev.top + EXPAND_AMOUNT }));
      const updates: { id: string; position_x: number; position_y: number }[] = [];
      blocks.forEach((b) => {
        const pos = positions.get(b.id);
        if (!pos) return;
        updates.push({
          id: b.id,
          position_x: pos.x,
          position_y: pos.y + EXPAND_AMOUNT,
        });
      });
      // Persist shifted positions
      batchSavePositions(updates);
    } else if (direction === 'left') {
      // Shift all block positions right by EXPAND_AMOUNT
      setCanvasExtra((prev) => ({ ...prev, left: prev.left + EXPAND_AMOUNT }));
      const updates: { id: string; position_x: number; position_y: number }[] = [];
      blocks.forEach((b) => {
        const pos = positions.get(b.id);
        if (!pos) return;
        updates.push({
          id: b.id,
          position_x: pos.x + EXPAND_AMOUNT,
          position_y: pos.y,
        });
      });
      // Persist shifted positions
      batchSavePositions(updates);
    }
  }, [blocks, positions]);

  // Shrink canvas after drag ends — reclaim unused space
  const handleDragEndWithShrink = useCallback((id: string, x: number, y: number) => {
    // Save the dragged block's new position
    updatePosition.mutate({ id, goalId, position_x: x, position_y: y });

    // Build an updated positions map with the dragged block's new coords
    const updatedPositions = new Map(positions);
    updatedPositions.set(id, { x, y });
    // Also include auto-laid blocks that don't have saved positions yet
    blocks.forEach((b) => {
      if (!updatedPositions.has(b.id)) {
        updatedPositions.set(b.id, { x: 0, y: 0 });
      }
    });

    let minX = Infinity, minY = Infinity;
    updatedPositions.forEach((pos) => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
    });

    const shiftX = minX > EXPAND_THRESHOLD ? minX - EXPAND_THRESHOLD : 0;
    const shiftY = minY > EXPAND_THRESHOLD ? minY - EXPAND_THRESHOLD : 0;

    if (shiftX > 0 || shiftY > 0) {
      const updates: { id: string; position_x: number; position_y: number }[] = [];
      blocks.forEach((b) => {
        const pos = updatedPositions.get(b.id);
        if (!pos) return;
        updates.push({
          id: b.id,
          position_x: pos.x - shiftX,
          position_y: pos.y - shiftY,
        });
      });
      // TODO: Replace individual updates with a batch upsert when block counts grow large
      batchSavePositions(updates);
    }

    // Reset canvas extra — container sizing computes from block positions
    setCanvasExtra({ top: 0, right: 0, bottom: 0, left: 0 });
  }, [blocks, positions, goalId, updatePosition]);

  const filesBlockLabel = "Files";
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
        <div className="overflow-auto pb-4">
          <div
            className="relative border border-dashed border-muted-foreground/20 rounded-lg"
            style={{ width: containerWidth, height: containerHeight, transition: 'width 0.3s ease, height 0.3s ease' }}
          >
            <AbsoluteConnectors
              blocks={activeBlocks.map((b) => ({ ...b, dependencies: b.dependencies.filter((d) => positions.has(d)) }))}
              positions={positions}
              dragOffsets={new Map()}
              blockSizes={new Map()}
            />
            {activeBlocks.map((block) => {
              const pos = positions.get(block.id) || { x: 0, y: 0 };
              return (
                <BlockCard
                  key={block.id}
                  block={block}
                  posX={pos.x}
                  posY={pos.y}
                  creatorName={block.created_by ? creatorMap.get(block.created_by)?.username : undefined}
                  creatorAvatarSeed={block.created_by ? creatorMap.get(block.created_by)?.avatar_seed : undefined}
                  isAnimatingOut={animatingOutId === block.id}
                  canvasWidth={containerWidth}
                  canvasHeight={containerHeight}
                  onComplete={(id) => {
                    const b = blocks.find((bl) => bl.id === id);
                    const isCompleting = b?.status !== "complete";
                    const updates: any = isCompleting
                      ? { status: "complete", brick_color: pickUtahColor(), completed_by: user?.id || null, completed_at: new Date().toISOString() }
                      : { status: "pending", brick_color: null, completed_by: null, completed_at: null };
                    if (isCompleting) setAnimatingOutId(id);
                    updateBlock.mutate({ id, goalId, updates }, {
                      onError: (err: any) => {
                        console.error("Block completion failed:", err);
                        toast.error(err?.message || "Failed to update block");
                        setAnimatingOutId(null);
                      },
                      onSettled: () => { if (isCompleting) setTimeout(() => setAnimatingOutId(null), 450); },
                    });
                  }}
                  onAddSuccessor={(b) => { setSuccessorParent(b); setAddDialogOpen(true); }}
                  onEditDeps={setEditDepsBlock}
                  onNavigate={onNavigateToBlock}
                  onEdit={(b) => user ? setEditBlock(b) : toast.error("Sign in to edit")}
                  onDragEnd={handleDragEndWithShrink}
                  onDragNearEdge={handleDragNearEdge}
                />
              );
            })}
          </div>

          {/* Brick strip — completed blocks as compact bricks */}
          <BrickStrip
            bricks={completedBricks}
            creatorMap={creatorMap}
            onReopen={(id) => {
              updateBlock.mutate({
                id,
                goalId,
                updates: { status: "pending", brick_color: null, completed_by: null, completed_at: null },
              });
            }}
          />
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

// --- Brick strip: completed blocks rendered as compact colored bricks ---
function BrickStrip({
  bricks,
  creatorMap,
  onReopen,
}: {
  bricks: BlockWithDeps[];
  creatorMap: Map<string, { username: string; avatar_seed: string }>;
  onReopen: (id: string) => void;
}) {
  if (bricks.length === 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-dashed border-muted-foreground/20">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono mb-2">
        Completed ({bricks.length})
      </h3>
      <TooltipProvider delayDuration={150}>
        <div className="flex flex-wrap gap-1">
          {bricks.map((b) => {
            const color = (b as any).brick_color || "#D3D1C7";
            const isLight = color.toUpperCase() === "#E8E4D9" || color.toUpperCase() === "#D3D1C7";
            const completer = (b as any).completed_by ? creatorMap.get((b as any).completed_by) : null;
            const completedAt = (b as any).completed_at ? new Date((b as any).completed_at) : null;
            return (
              <Popover key={b.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        aria-label={`Completed: ${b.title}`}
                        className="rounded-md transition-transform hover:scale-105 animate-fade-in flex items-center"
                        style={{
                          width: 148,
                          height: 36,
                          backgroundColor: color,
                          border: isLight ? "1px solid #B4B2A9" : "none",
                          paddingLeft: 6,
                        }}
                      >
                        {completer ? (
                          <img
                            src={`https://api.dicebear.com/7.x/bottts/svg?seed=${completer.avatar_seed}`}
                            alt={completer.username}
                            className="w-6 h-6 rounded-full bg-white/30 shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gray-400/60 shrink-0" />
                        )}
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-[#1a1a1a] text-white border-0 px-2 py-2 rounded-md text-[13px] max-w-xs"
                  >
                    <div className="font-bold leading-tight">{b.title}</div>
                    {completer && (
                      <div className="text-white/80 leading-tight mt-0.5">
                        Completed by {completer.username}
                      </div>
                    )}
                    {completedAt && (
                      <div className="text-white/60 leading-tight mt-0.5">
                        {completedAt.toLocaleString(undefined, {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "numeric", minute: "2-digit",
                        })}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
                <PopoverContent side="top" className="w-auto p-2 flex items-center gap-2">
                  <span className="text-xs">Reopen this block?</span>
                  <Button size="sm" className="h-6 text-[11px]" onClick={() => onReopen(b.id)}>
                    Confirm
                  </Button>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}
function EditBlockDialog({ block, goalId, open, onOpenChange }: {
  block: BlockWithDeps; goalId: string; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [title, setTitle] = useState(block.title);
  const [description, setDescription] = useState(block.description || "");
  const [status, setStatus] = useState(block.status || "pending");
  const [deadlineAt, setDeadlineAt] = useState((block as any).deadline_at ? new Date((block as any).deadline_at).toISOString().slice(0, 16) : "");
  const [recurrenceInterval, setRecurrenceInterval] = useState((block as any).recurrence_interval || "");
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
    
    const newDeadline = deadlineAt ? new Date(deadlineAt).toISOString() : null;
    const oldDeadline = (block as any).deadline_at || null;
    if (newDeadline !== oldDeadline) updates.deadline_at = newDeadline;
    
    const newRecurrence = recurrenceInterval || null;
    const oldRecurrence = (block as any).recurrence_interval || null;
    if (newRecurrence !== oldRecurrence) updates.recurrence_interval = newRecurrence;

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
          <div>
            <label className="text-xs text-muted-foreground font-medium flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3" /> Deadline
            </label>
            <Input type="datetime-local" value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)} className="text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3" /> Recurring reopen
            </label>
            <Select value={recurrenceInterval} onValueChange={setRecurrenceInterval}>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          {user && (
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
          )}
          <Button size="sm" onClick={handleSave} disabled={!title.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

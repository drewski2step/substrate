import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useBlocks, BlockWithDeps } from "@/hooks/use-blocks";
import { toast } from "sonner";

interface MoveBlockModalProps {
  blockId: string;
  blockTitle: string;
  missionId: string;
  currentParentId: string | null;
  onClose: () => void;
  onMoved: () => void;
}

/** Collect all descendant IDs of a block (recursive). */
function collectDescendantIds(blockId: string, blocks: BlockWithDeps[]): Set<string> {
  const descendants = new Set<string>();
  const queue = [blockId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const b of blocks) {
      if (b.parent_block_id === current && !descendants.has(b.id)) {
        descendants.add(b.id);
        queue.push(b.id);
      }
    }
  }
  return descendants;
}

export function MoveBlockModal({ blockId, blockTitle, missionId, currentParentId, onClose, onMoved }: MoveBlockModalProps) {
  const { data: allBlocks } = useBlocks(missionId);
  const blocks = allBlocks ?? [];

  const initialPath = useMemo(() => {
    const chain: BlockWithDeps[] = [];
    let id: string | null = currentParentId;
    const guard = new Set<string>();
    while (id && !guard.has(id)) {
      guard.add(id);
      const b = blocks.find((x) => x.id === id);
      if (!b) break;
      chain.unshift(b);
      id = b.parent_block_id ?? null;
    }
    return chain;
  }, [blocks, currentParentId]);

  const [path, setPath] = useState<BlockWithDeps[]>(initialPath);
  const [initialized, setInitialized] = useState(initialPath.length > 0);
  const [moving, setMoving] = useState(false);

  if (!initialized && initialPath.length > 0) {
    setPath(initialPath);
    setInitialized(true);
  }

  const descendantIds = useMemo(
    () => collectDescendantIds(blockId, blocks),
    [blocks, blockId]
  );

  const currentFolderId = path.length > 0 ? path[path.length - 1].id : null;

  const isSelectable = (b: BlockWithDeps) =>
    !(b as any).is_files_block && b.status !== "complete";

  const visibleChildren = useMemo(() => {
    return blocks.filter((b) => b.parent_block_id === currentFolderId && isSelectable(b));
  }, [blocks, currentFolderId]);

  const isBlocked = (id: string) => id === blockId || descendantIds.has(id);

  const hasVisibleChildren = (parentId: string) =>
    blocks.some((b) => b.parent_block_id === parentId && isSelectable(b));

  const handleNavigateInto = (block: BlockWithDeps) => {
    if (isBlocked(block.id)) return;
    setPath([...path, block]);
  };

  const handleBack = () => {
    if (path.length === 0) return;
    setPath(path.slice(0, -1));
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index < 0) setPath([]);
    else setPath(path.slice(0, index + 1));
  };

  const handleMoveTo = async (newParentId: string | null) => {
    if (moving) return;
    if (newParentId === currentParentId) {
      toast.info("Block is already there");
      onClose();
      return;
    }
    setMoving(true);
    const { error } = await supabase
      .from("blocks")
      .update({ parent_block_id: newParentId } as any)
      .eq("id", blockId);
    setMoving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Block moved");
    onMoved();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Move '{blockTitle}' to...</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          {path.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-7 px-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                {path.length === 0 ? (
                  <BreadcrumbPage className="text-xs">Mission</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="text-xs cursor-pointer"
                    onClick={() => handleBreadcrumbClick(-1)}
                  >
                    Mission
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {path.map((b, i) => (
                <BreadcrumbItem key={b.id}>
                  <BreadcrumbSeparator />
                  {i === path.length - 1 ? (
                    <BreadcrumbPage className="text-xs">{b.title}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      className="text-xs cursor-pointer"
                      onClick={() => handleBreadcrumbClick(i)}
                    >
                      {b.title}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <ScrollArea className="h-64 border rounded-md">
          <div className="p-1 space-y-0.5">
            {path.length > 0 && (
              <div className="flex items-stretch rounded overflow-hidden text-xs">
                <button
                  type="button"
                  disabled={moving || currentParentId === null}
                  onClick={() => handleMoveTo(null)}
                  className="flex-1 text-left px-3 py-2 truncate hover:bg-muted/60 transition-colors disabled:opacity-50"
                  title="Move to mission level"
                >
                  <span className="font-medium">Move to mission level</span>
                </button>
                <div className="w-px bg-border" aria-hidden="true" />
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-11 flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
                  aria-label="Go up one level"
                  title="Go up one level"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            )}
            {visibleChildren.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">No sub-blocks at this level</p>
            )}
            {visibleChildren.map((b) => {
              const blocked = isBlocked(b.id);
              const showChevron = !blocked && hasVisibleChildren(b.id);
              const isCurrent = currentParentId === b.id;

              if (blocked) {
                return (
                  <div
                    key={b.id}
                    className="flex items-center px-3 py-2 rounded text-xs opacity-40 cursor-not-allowed"
                  >
                    <span className="font-medium truncate">{b.title}</span>
                  </div>
                );
              }

              return (
                <div
                  key={b.id}
                  className="flex items-stretch rounded overflow-hidden text-xs"
                >
                  <button
                    type="button"
                    disabled={moving}
                    onClick={() => handleMoveTo(b.id)}
                    className={cn(
                      "flex-1 text-left px-3 py-2 truncate hover:bg-muted/60 transition-colors disabled:opacity-50",
                      isCurrent && "text-muted-foreground"
                    )}
                    title={`Move into ${b.title}`}
                  >
                    <span className="font-medium">{b.title}</span>
                    {isCurrent && (
                      <span className="ml-2 text-[10px] text-muted-foreground">(current parent)</span>
                    )}
                  </button>
                  {showChevron && (
                    <>
                      <div className="w-px bg-border" aria-hidden="true" />
                      <button
                        type="button"
                        onClick={() => handleNavigateInto(b)}
                        className="w-11 flex items-center justify-center hover:bg-muted transition-colors"
                        aria-label={`Open ${b.title}`}
                        title={`Show contents of ${b.title}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

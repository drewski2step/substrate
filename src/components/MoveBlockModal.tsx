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
  // path: array of block ids from root toward current folder. Empty = root ("Mission").
  const [path, setPath] = useState<BlockWithDeps[]>([]);
  const [moving, setMoving] = useState(false);

  const blocks = allBlocks ?? [];

  const descendantIds = useMemo(
    () => collectDescendantIds(blockId, blocks),
    [blocks, blockId]
  );

  const currentFolderId = path.length > 0 ? path[path.length - 1].id : null;

  const visibleChildren = useMemo(() => {
    return blocks.filter(
      (b) => b.parent_block_id === currentFolderId && !(b as any).is_files_block
    );
  }, [blocks, currentFolderId]);

  const isBlocked = (id: string) => id === blockId || descendantIds.has(id);

  const handleNavigateInto = (block: BlockWithDeps) => {
    if (isBlocked(block.id)) return;
    setPath([...path, block]);
  };

  const handleBack = () => {
    if (path.length === 0) return;
    setPath(path.slice(0, -1));
  };

  const handleBreadcrumbClick = (index: number) => {
    // index = -1 means Mission root
    if (index < 0) setPath([]);
    else setPath(path.slice(0, index + 1));
  };

  const handleMove = async () => {
    setMoving(true);
    const newParentId = currentFolderId; // null at root
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

  const moveButtonLabel =
    currentFolderId === null
      ? "Move to top level"
      : `Move into ${path[path.length - 1].title}`;

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
          <div className="p-1">
            {visibleChildren.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">No sub-blocks at this level</p>
            )}
            {visibleChildren.map((b) => {
              const blocked = isBlocked(b.id);
              return (
                <div
                  key={b.id}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded text-xs transition-colors",
                    blocked ? "opacity-40 cursor-not-allowed" : "hover:bg-muted/60",
                    currentParentId === b.id && !blocked && "text-muted-foreground"
                  )}
                >
                  <span className="font-medium truncate">
                    {b.title}
                    {currentParentId === b.id && (
                      <span className="ml-2 text-[10px] text-muted-foreground">(current parent)</span>
                    )}
                  </span>
                  {!blocked && (
                    <button
                      onClick={() => handleNavigateInto(b)}
                      className="p-1 rounded hover:bg-muted"
                      aria-label={`Open ${b.title}`}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleMove} disabled={moving}>
            {moving ? "Moving..." : moveButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

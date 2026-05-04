import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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

/** DFS traversal from root nodes to produce blocks in hierarchy order with depth. */
function buildHierarchyOrder(blocks: BlockWithDeps[]): { block: BlockWithDeps; depth: number }[] {
  const childrenMap = new Map<string | null, BlockWithDeps[]>();
  for (const b of blocks) {
    const key = b.parent_block_id;
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(b);
  }

  const result: { block: BlockWithDeps; depth: number }[] = [];
  function dfs(parentId: string | null, depth: number) {
    const children = childrenMap.get(parentId) || [];
    for (const child of children) {
      result.push({ block: child, depth });
      dfs(child.id, depth + 1);
    }
  }
  dfs(null, 0);
  return result;
}

export function MoveBlockModal({ blockId, blockTitle, missionId, currentParentId, onClose, onMoved }: MoveBlockModalProps) {
  const { data: allBlocks } = useBlocks(missionId);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [moving, setMoving] = useState(false);

  const descendantIds = useMemo(() => {
    if (!allBlocks) return new Set<string>();
    return collectDescendantIds(blockId, allBlocks);
  }, [allBlocks, blockId]);

  const destinations = useMemo(() => {
    if (!allBlocks) return [];
    const eligible = allBlocks.filter(
      (b) => b.id !== blockId && !descendantIds.has(b.id) && !(b as any).is_files_block
    );
    return buildHierarchyOrder(eligible);
  }, [allBlocks, blockId, descendantIds]);

  const filteredDestinations = useMemo(() => {
    if (!search.trim()) return destinations;
    const q = search.toLowerCase();
    return destinations.filter((d) => d.block.title.toLowerCase().includes(q));
  }, [destinations, search]);

  const handleMove = async () => {
    if (selected === null) return;
    setMoving(true);
    const newParentId = selected === "root" ? null : selected;
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

        <Input
          placeholder="Filter destinations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm"
        />

        <ScrollArea className="h-64 border rounded-md">
          <div className="p-1">
            {/* Top level (no parent) option */}
            <button
              onClick={() => setSelected("root")}
              className={cn(
                "w-full text-left px-3 py-2 rounded text-xs hover:bg-muted/60 transition-colors",
                selected === "root" && "bg-primary/10 ring-1 ring-primary",
                currentParentId === null && "text-muted-foreground"
              )}
            >
              <span className="font-medium">↑ Top level (no parent)</span>
              {currentParentId === null && (
                <span className="ml-2 text-[10px] text-muted-foreground">(current)</span>
              )}
            </button>

            {filteredDestinations.map(({ block: dest, depth }) => (
              <button
                key={dest.id}
                onClick={() => setSelected(dest.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded text-xs hover:bg-muted/60 transition-colors",
                  selected === dest.id && "bg-primary/10 ring-1 ring-primary",
                  currentParentId === dest.id && "text-muted-foreground"
                )}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
              >
                <span className="font-medium">{dest.title}</span>
                {currentParentId === dest.id && (
                  <span className="ml-2 text-[10px] text-muted-foreground">(current parent)</span>
                )}
              </button>
            ))}

            {filteredDestinations.length === 0 && search.trim() && (
              <p className="text-xs text-muted-foreground p-3">No matching blocks.</p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleMove} disabled={selected === null || moving}>
            {moving ? "Moving..." : "Move here"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

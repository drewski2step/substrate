import { useState } from "react";
import { useMissionDiscussions, useCreateDiscussion, DiscussionRow } from "@/hooks/use-discussions";
import { useBlocks, BlockWithDeps } from "@/hooks/use-blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Lightbulb, AlertTriangle, Link2, FileText, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PostCard } from "@/components/DiscussionPanel";

const typeConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  question: { color: "bg-blue-100 text-blue-700 border-blue-200", icon: HelpCircle, label: "Question" },
  insight: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Lightbulb, label: "Insight" },
  blocker: { color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle, label: "Blocker" },
  resource: { color: "bg-purple-100 text-purple-700 border-purple-200", icon: Link2, label: "Resource" },
  proposal: { color: "bg-amber-100 text-amber-700 border-amber-200", icon: FileText, label: "Proposal" },
};

export function MissionFeed({ goalId, missionId }: { goalId: string; missionId: string }) {
  const { data: posts, isLoading } = useMissionDiscussions(goalId);
  const { data: allBlocks } = useBlocks(goalId);
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const blockMap = new Map((allBlocks || []).map((b) => [b.id, b]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Mission Feed</h2>
        <Button size="sm" className="gap-1.5" onClick={() => setComposerOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Post to feed
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !posts || posts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No mission-wide posts yet.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const taggedBlock = post.block_id ? blockMap.get(post.block_id) : null;
            return (
              <div key={post.id}>
                {taggedBlock && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono mb-1 inline-block">
                    {taggedBlock.title}
                  </span>
                )}
                <PostCard
                  post={post}
                  goalId={goalId}
                  expanded={expandedId === post.id}
                  onExpand={() => setExpandedId(expandedId === post.id ? null : post.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      <FeedComposer goalId={goalId} blocks={allBlocks || []} open={composerOpen} onOpenChange={setComposerOpen} />
    </div>
  );
}

function FeedComposer({ goalId, blocks, open, onOpenChange }: {
  goalId: string; blocks: BlockWithDeps[]; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [type, setType] = useState("insight");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [blockId, setBlockId] = useState<string>("none");
  const createDiscussion = useCreateDiscussion();

  const sortedBlocks = [...blocks].sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0));

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    createDiscussion.mutate(
      {
        block_id: blockId === "none" ? null : blockId,
        goal_id: goalId,
        type,
        title: title.trim(),
        content: content.trim(),
        scope: "mission",
      },
      {
        onSuccess: () => { setTitle(""); setContent(""); setType("insight"); setBlockId("none"); onOpenChange(false); },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setTitle(""); setContent(""); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Post to Mission Feed</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(typeConfig).map(([key, cfg]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  <span className="flex items-center gap-1.5"><cfg.icon className="w-3.5 h-3.5" />{cfg.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Title (required)" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
          <Textarea placeholder="Content (required)" value={content} onChange={(e) => setContent(e.target.value)} className="text-sm min-h-[80px]" />
          <Select value={blockId} onValueChange={setBlockId}>
            <SelectTrigger className="text-xs h-8">
              <SelectValue placeholder="Tag a block (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">None</SelectItem>
              {sortedBlocks.map((b) => (
                <SelectItem key={b.id} value={b.id} className="text-xs">
                  {b.title} {(b.heat ?? 0) > 0 && <span className="text-muted-foreground ml-1">🔥{b.heat}</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={handleSubmit} disabled={!title.trim() || !content.trim() || createDiscussion.isPending}>
            {createDiscussion.isPending ? "Posting..." : "Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

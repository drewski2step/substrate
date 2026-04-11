import { useState } from "react";
import { cn } from "@/lib/utils";
import { useBlockDiscussions, useCreateDiscussion, useUpvoteDiscussion, useResolveDiscussion, useDiscussionReplies, useEditDiscussion, useDeleteDiscussion, DiscussionRow } from "@/hooks/use-discussions";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Plus, ArrowUp, MessageSquare, CheckCircle2, AlertTriangle, Lightbulb, Link2, FileText, HelpCircle, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const typeConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  question: { color: "bg-blue-100 text-blue-700 border-blue-200", icon: HelpCircle, label: "Question" },
  insight: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Lightbulb, label: "Insight" },
  blocker: { color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle, label: "Blocker" },
  resource: { color: "bg-purple-100 text-purple-700 border-purple-200", icon: Link2, label: "Resource" },
  proposal: { color: "bg-amber-100 text-amber-700 border-amber-200", icon: FileText, label: "Proposal" },
};

function TypeBadge({ type }: { type: string }) {
  const cfg = typeConfig[type] || typeConfig.insight;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border", cfg.color)}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function ReplyThread({ parentId, blockId, goalId }: { parentId: string; blockId: string; goalId: string }) {
  const { data: replies } = useDiscussionReplies(parentId);
  const createDiscussion = useCreateDiscussion();
  const editDiscussion = useEditDiscussion();
  const deleteDiscussion = useDeleteDiscussion();
  const { user } = useAuth();
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  return (
    <div className="ml-4 mt-2 border-l-2 border-border pl-3 space-y-2">
      {replies?.map((r) => {
        const isDeleted = !!r.deleted_at;
        const isOwner = user?.id === r.user_id;
        const isEditing = editingId === r.id;

        if (isDeleted) {
          return (
            <div key={r.id} className="text-xs text-muted-foreground italic py-1">
              This post was deleted
            </div>
          );
        }

        return (
          <div key={r.id} className="text-xs group/reply">
            <span className="font-semibold">Anonymous</span>
            <span className="text-muted-foreground ml-2">{format(new Date(r.created_at), "MMM d, h:mm a")}</span>
            {r.edited_at && <span className="text-muted-foreground ml-1 text-[10px]">(edited)</span>}
            {isEditing ? (
              <div className="mt-1 flex gap-1.5">
                <Input value={editText} onChange={(e) => setEditText(e.target.value)} className="text-xs h-7" />
                <Button size="sm" className="h-7 text-xs" onClick={() => {
                  editDiscussion.mutate({ id: r.id, content: editText.trim() }, { onSuccess: () => setEditingId(null) });
                }}>Save</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
              </div>
            ) : (
              <p className="mt-0.5 leading-relaxed">{r.content}</p>
            )}
            {isOwner && !isEditing && (
              <div className="flex gap-2 mt-0.5 opacity-0 group-hover/reply:opacity-100 transition-opacity">
                <button onClick={() => { setEditingId(r.id); setEditText(r.content); }} className="text-[10px] text-muted-foreground hover:text-primary">Edit</button>
                <button onClick={() => deleteDiscussion.mutate({ id: r.id, hasReplies: false })} className="text-[10px] text-muted-foreground hover:text-destructive">Delete</button>
              </div>
            )}
          </div>
        );
      })}
      {showReply ? (
        <div className="flex gap-1.5">
          <Input
            placeholder="Reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="text-xs h-7"
            onKeyDown={(e) => {
              if (e.key === "Enter" && replyText.trim()) {
                createDiscussion.mutate(
                  { block_id: blockId, goal_id: goalId, parent_id: parentId, type: "insight", content: replyText.trim() },
                  { onSuccess: () => { setReplyText(""); setShowReply(false); }, onError: (err: any) => toast.error(err.message) }
                );
              }
            }}
          />
          <Button size="sm" className="h-7 text-xs" onClick={() => {
            if (!replyText.trim()) return;
            createDiscussion.mutate(
              { block_id: blockId, goal_id: goalId, parent_id: parentId, type: "insight", content: replyText.trim() },
              { onSuccess: () => { setReplyText(""); setShowReply(false); }, onError: (err: any) => toast.error(err.message) }
            );
          }}>Send</Button>
        </div>
      ) : (
        <button onClick={() => setShowReply(true)} className="text-[10px] text-primary hover:underline">Reply</button>
      )}
    </div>
  );
}

function PostCard({ post, goalId, onExpand, expanded }: { post: DiscussionRow; goalId: string; onExpand: () => void; expanded: boolean }) {
  const upvote = useUpvoteDiscussion();
  const resolve = useResolveDiscussion();
  const editDiscussion = useEditDiscussion();
  const deleteDiscussion = useDeleteDiscussion();
  const { data: replies } = useDiscussionReplies(post.id);
  const { user } = useAuth();
  const isOwner = user?.id === post.user_id;
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title || "");
  const [editContent, setEditContent] = useState(post.content);

  if (post.deleted_at) {
    const hasReplies = replies && replies.length > 0;
    if (!hasReplies) return null;
    return (
      <div className="border rounded-lg p-3 text-xs text-muted-foreground italic">
        This post was deleted
        <ReplyThread parentId={post.id} blockId={post.block_id || ""} goalId={goalId} />
      </div>
    );
  }

  return (
    <div className={cn("border rounded-lg p-3 transition-all group/post", post.type === "blocker" && !post.resolved && "border-destructive/50")}>
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); upvote.mutate({ id: post.id, blockId: post.block_id }); }}
          className="flex flex-col items-center gap-0.5 pt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono tabular-nums">{post.upvotes}</span>
        </button>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <TypeBadge type={post.type} />
            {post.resolved && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Resolved
              </span>
            )}
            {post.edited_at && <span className="text-[10px] text-muted-foreground">(edited)</span>}
          </div>
          {editing ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-sm" placeholder="Title" />
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="text-xs min-h-[40px]" />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-7 text-xs" onClick={() => {
                  editDiscussion.mutate({ id: post.id, content: editContent.trim(), title: editTitle.trim() || null }, {
                    onSuccess: () => setEditing(false),
                    onError: (err: any) => toast.error(err.message),
                  });
                }}>Save</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              {post.title && <p className="text-sm font-medium leading-tight">{post.title}</p>}
              <p className={cn("text-xs text-muted-foreground mt-0.5", !expanded && "line-clamp-2")}>{post.content}</p>
            </>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
            <span>{format(new Date(post.created_at), "MMM d, h:mm a")}</span>
            <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" /> {replies?.length || 0} replies</span>
          </div>
        </div>
        {isOwner && !editing && (
          <div className="flex gap-1 opacity-0 group-hover/post:opacity-100 transition-opacity shrink-0">
            <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="p-1 rounded hover:bg-muted">
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </button>
            <button onClick={(e) => {
              e.stopPropagation();
              deleteDiscussion.mutate({ id: post.id, hasReplies: (replies?.length || 0) > 0 });
            }} className="p-1 rounded hover:bg-destructive/10">
              <Trash2 className="w-3 h-3 text-destructive" />
            </button>
          </div>
        )}
      </div>
      {expanded && !editing && (
        <div className="mt-3">
          {post.type === "question" && !post.resolved && (
            <Button
              size="sm" variant="outline" className="text-xs mb-2 gap-1"
              onClick={() => resolve.mutate({ id: post.id, blockId: post.block_id })}
            >
              <CheckCircle2 className="w-3 h-3" /> Mark resolved
            </Button>
          )}
          <ReplyThread parentId={post.id} blockId={post.block_id || ""} goalId={goalId} />
        </div>
      )}
    </div>
  );
}

export function DiscussionPanel({ blockId, goalId }: { blockId: string; goalId: string }) {
  const { data: posts, isLoading } = useBlockDiscussions(blockId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "question" | "blocker">("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = (posts || []).filter((p) => {
    if (filter === "question" && p.type !== "question") return false;
    if (filter === "blocker" && p.type !== "blocker") return false;
    if (search) {
      const q = search.toLowerCase();
      return (p.title?.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Discussions</h3>
        <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => setComposerOpen(true)}>
          <Plus className="w-3 h-3" /> Post
        </Button>
      </div>
      <div className="px-3 py-2 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search discussions..." value={search} onChange={(e) => setSearch(e.target.value)} className="text-xs h-7 pl-7" />
        </div>
        <div className="flex gap-1">
          {(["all", "question", "blocker"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >{f === "all" ? "All" : f === "question" ? "Questions" : "Blockers"}</button>
          ))}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No discussions yet. Start one!</p>
          ) : (
            filtered.map((post) => (
              <PostCard
                key={post.id} post={post} goalId={goalId}
                expanded={expandedId === post.id}
                onExpand={() => setExpandedId(expandedId === post.id ? null : post.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
      <ComposeDialog blockId={blockId} goalId={goalId} open={composerOpen} onOpenChange={setComposerOpen} />
    </div>
  );
}

function ComposeDialog({ blockId, goalId, open, onOpenChange, defaultScope }: {
  blockId?: string | null; goalId: string; open: boolean; onOpenChange: (o: boolean) => void; defaultScope?: string;
}) {
  const [type, setType] = useState("insight");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [missionWide, setMissionWide] = useState(defaultScope === "mission");
  const createDiscussion = useCreateDiscussion();
  const { user } = useAuth();

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return;
    createDiscussion.mutate(
      {
        block_id: blockId || null,
        goal_id: goalId,
        type,
        title: title.trim(),
        content: content.trim(),
        scope: missionWide ? "mission" : "block",
        user_id: user?.id || null,
      },
      {
        onSuccess: () => { setTitle(""); setContent(""); setType("insight"); setMissionWide(false); onOpenChange(false); },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setTitle(""); setContent(""); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">New Discussion</DialogTitle>
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
          <div className="flex items-center gap-2">
            <Switch id="scope" checked={missionWide} onCheckedChange={setMissionWide} />
            <Label htmlFor="scope" className="text-xs">Also share to mission-wide feed</Label>
          </div>
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

// Exported for use in MissionView feed
export { ComposeDialog, PostCard, TypeBadge };

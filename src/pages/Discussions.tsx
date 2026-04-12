import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/hooks/use-auth";
import { getAvatarUrl } from "@/hooks/use-auth";
import { useUpvoteDiscussion, useResolveDiscussion, useDiscussionReplies, useCreateDiscussion, useEditDiscussion, useDeleteDiscussion, DiscussionRow } from "@/hooks/use-discussions";
import { ReplyThread } from "@/components/DiscussionPanel";
import { cn } from "@/lib/utils";
import { Search, ArrowUp, MessageSquare, CheckCircle2, HelpCircle, Lightbulb, AlertTriangle, Link2, FileText, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const typeConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  question: { color: "bg-blue-100 text-blue-700 border-blue-200", icon: HelpCircle, label: "Question" },
  insight: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Lightbulb, label: "Insight" },
  blocker: { color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle, label: "Blocker" },
  resource: { color: "bg-purple-100 text-purple-700 border-purple-200", icon: Link2, label: "Resource" },
  proposal: { color: "bg-amber-100 text-amber-700 border-amber-200", icon: FileText, label: "Proposal" },
};

type EnrichedPost = DiscussionRow & {
  mission_title?: string;
  mission_id?: string;
  block_title?: string;
  author_username?: string;
  author_avatar_seed?: string;
  author_avatar_url?: string | null;
  reply_count: number;
  relevance_score: number;
};

function useGlobalDiscussions() {
  return useQuery({
    queryKey: ["global-discussions"],
    queryFn: async () => {
      // 1. Get all public goals
      const { data: goals } = await supabase.from("goals").select("id, title").eq("visibility", "public");
      if (!goals || goals.length === 0) return [];
      const goalMap = new Map(goals.map((g) => [g.id, g.title]));
      const goalIds = goals.map((g) => g.id);

      // 2. Get top-level discussions for those goals
      const { data: posts, error } = await supabase
        .from("discussions" as any)
        .select("*")
        .in("goal_id", goalIds)
        .is("parent_id", null)
        .is("deleted_at", null);
      if (error) throw error;
      if (!posts || posts.length === 0) return [];
      const discussions = posts as unknown as DiscussionRow[];

      // 3. Batch fetch related data
      const blockIds = [...new Set(discussions.filter((d) => d.block_id).map((d) => d.block_id!))];
      const userIds = [...new Set(discussions.filter((d) => d.user_id).map((d) => d.user_id!))];

      const [blocksRes, profilesRes, repliesRes] = await Promise.all([
        blockIds.length > 0
          ? supabase.from("blocks").select("id, title, goal_id").in("id", blockIds)
          : { data: [] },
        userIds.length > 0
          ? supabase.from("profiles").select("id, username, avatar_seed, avatar_url").in("id", userIds)
          : { data: [] },
        supabase
          .from("discussions" as any)
          .select("parent_id")
          .in("goal_id", goalIds)
          .not("parent_id", "is", null),
      ]);

      const blockMap = new Map((blocksRes.data || []).map((b: any) => [b.id, b]));
      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));

      const replyCounts = new Map<string, number>();
      for (const r of ((repliesRes.data as any[]) || [])) {
        replyCounts.set(r.parent_id, (replyCounts.get(r.parent_id) || 0) + 1);
      }

      // 4. Merge
      return discussions.map((d): EnrichedPost => {
        const block = d.block_id ? blockMap.get(d.block_id) : null;
        const profile = d.user_id ? profileMap.get(d.user_id) : null;
        return {
          ...d,
          mission_title: d.goal_id ? goalMap.get(d.goal_id) : undefined,
          mission_id: d.goal_id || undefined,
          block_title: block?.title || undefined,
          author_username: profile?.username || undefined,
          author_avatar_seed: profile?.avatar_seed || undefined,
          author_avatar_url: profile?.avatar_url || undefined,
          reply_count: replyCounts.get(d.id) || 0,
        };
      });
    },
  });
}

function GlobalPostCard({ post, expanded, onToggle }: { post: EnrichedPost; expanded: boolean; onToggle: () => void }) {
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

  const cfg = typeConfig[post.type] || typeConfig.insight;
  const Icon = cfg.icon;

  return (
    <div className={cn(
      "border rounded-lg p-4 transition-all group/post bg-card",
      post.type === "blocker" && !post.resolved && "border-destructive/50"
    )}>
      <div className="flex items-start gap-3">
        {/* Upvote */}
        {user ? (
          <button
            onClick={() => upvote.mutate({ id: post.id, blockId: post.block_id })}
            className="flex flex-col items-center gap-0.5 pt-0.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            <ArrowUp className="w-4 h-4" />
            <span className="text-xs font-mono tabular-nums">{post.upvotes}</span>
          </button>
        ) : (
          <div className="flex flex-col items-center gap-0.5 pt-0.5 text-muted-foreground shrink-0">
            <ArrowUp className="w-4 h-4" />
            <span className="text-xs font-mono tabular-nums">{post.upvotes}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border", cfg.color)}>
              <Icon className="w-3 h-3" /> {cfg.label}
            </span>
            {post.resolved && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" /> Resolved
              </span>
            )}
          </div>

          {editing ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <Textarea value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-sm min-h-[36px] resize-none" rows={1} placeholder="Title" />
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
              <p className={cn("text-xs text-muted-foreground mt-0.5", !expanded && "line-clamp-3")}>
                {expanded ? post.content : post.content.slice(0, 150) + (post.content.length > 150 ? "…" : "")}
              </p>
            </>
          )}

          {/* Breadcrumb: Mission → Block */}
          <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground flex-wrap">
            {post.mission_id && post.mission_title && (
              <Link
                to={`/mission/${post.mission_id}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-primary hover:underline transition-colors font-medium"
              >
                {post.mission_title}
              </Link>
            )}
            {post.block_id && post.block_title && (
              <>
                <ChevronRight className="w-3 h-3 shrink-0" />
                <Link
                  to={`/mission/${post.mission_id}/block/${post.block_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="hover:text-primary hover:underline transition-colors"
                >
                  {post.block_title}
                </Link>
              </>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            {post.author_username && (
              <Link
                to={`/profile/${post.author_username}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <img
                  src={post.author_avatar_url || getAvatarUrl(post.author_avatar_seed || "")}
                  alt={post.author_username}
                  className="w-4 h-4 rounded-full bg-muted"
                />
                <span className="font-medium">{post.author_username}</span>
              </Link>
            )}
            <span>{format(new Date(post.created_at), "MMM d, h:mm a")}</span>
            <span className="flex items-center gap-0.5">
              <MessageSquare className="w-3 h-3" /> {post.reply_count}
            </span>
          </div>
        </div>

        {/* Owner actions */}
        {isOwner && !editing && (
          <div className="flex gap-1 opacity-0 group-hover/post:opacity-100 transition-opacity shrink-0">
            <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="p-1 rounded hover:bg-muted">
              <Pencil className="w-3 h-3 text-muted-foreground" />
            </button>
            <button onClick={(e) => {
              e.stopPropagation();
              deleteDiscussion.mutate({ id: post.id, hasReplies: post.reply_count > 0 });
            }} className="p-1 rounded hover:bg-destructive/10">
              <Trash2 className="w-3 h-3 text-destructive" />
            </button>
          </div>
        )}
      </div>

      {/* Expanded area */}
      {expanded && !editing && (
        <div className="mt-4 pt-3 border-t border-border">
          {post.type === "question" && !post.resolved && isOwner && (
            <Button
              size="sm" variant="outline" className="text-xs mb-3 gap-1"
              onClick={() => resolve.mutate({ id: post.id, blockId: post.block_id })}
            >
              <CheckCircle2 className="w-3 h-3" /> Mark resolved
            </Button>
          )}
          {user ? (
            <ReplyThread parentId={post.id} blockId={post.block_id || ""} goalId={post.goal_id || ""} />
          ) : (
            <div>
              <ReplyThread parentId={post.id} blockId={post.block_id || ""} goalId={post.goal_id || ""} />
              <AuthGate className="mt-2" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Discussions() {
  const { data: posts, isLoading } = useGlobalDiscussions();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"top" | "new">("top");
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("global-discussions-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "discussions" }, () => {
        qc.invalidateQueries({ queryKey: ["global-discussions"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const filtered = useMemo(() => {
    let result = posts || [];
    if (filter !== "all") result = result.filter((p) => p.type === filter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.title?.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      if (sort === "top") return (b.relevance_score ?? 0) - (a.relevance_score ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [posts, filter, search, sort]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-8 animate-fade-in-up">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight font-mono">Discussions</h1>
          <p className="text-sm text-muted-foreground mt-1">Questions, insights and ideas from across the network</p>
        </div>

        {/* Search + Sort + Filter */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search discussions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {(["top", "new"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    sort === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {s === "top" ? "Top" : "New"}
                </button>
              ))}
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="text-xs h-8 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Types</SelectItem>
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    <span className="flex items-center gap-1"><cfg.icon className="w-3 h-3" />{cfg.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Post list */}
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-16">Loading discussions…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-muted-foreground">No discussions found.</p>
              <p className="text-xs text-muted-foreground mt-1">Start a discussion in any mission to see it here.</p>
            </div>
          ) : (
            filtered.map((post) => (
              <GlobalPostCard
                key={post.id}
                post={post}
                expanded={expandedId === post.id}
                onToggle={() => setExpandedId(expandedId === post.id ? null : post.id)}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

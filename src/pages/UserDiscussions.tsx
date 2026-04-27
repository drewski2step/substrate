import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function UserDiscussions() {
  const { username } = useParams<{ username: string }>();

  const { data: profile } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("username", username!).maybeSingle();
      return data;
    },
    enabled: !!username,
  });

  const { data: posts, isLoading } = useQuery({
    queryKey: ["user-discussions-page", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("discussions")
        .select("id, content, created_at, goal_id, block_id, goals(title)")
        .eq("user_id", profile!.id)
        .is("parent_id", null)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 animate-fade-in-up">
        <Link
          to={`/profile/${username}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {username}
        </Link>

        <h1 className="text-xl font-bold font-mono mb-1">Discussions</h1>
        <p className="text-sm text-muted-foreground font-mono mb-8">
          {isLoading ? "Loading…" : `${posts?.length ?? 0} posts`}
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="space-y-2">
            {posts.map((p: any) => (
              <Link
                key={p.id}
                to={p.block_id ? `/mission/${p.goal_id}/block/${p.block_id}` : `/mission/${p.goal_id}`}
                className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono truncate">{p.content}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.goals?.title && (
                      <span className="text-xs text-muted-foreground font-mono truncate">{p.goals.title}</span>
                    )}
                    <span className="text-xs text-muted-foreground/50 font-mono shrink-0">
                      {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground font-mono">No discussions yet.</p>
        )}
      </main>
    </>
  );
}

import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function CompletedBlocks() {
  const { username } = useParams<{ username: string }>();

  const { data: profile } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("username", username!).maybeSingle();
      return data;
    },
    enabled: !!username,
  });

  const { data: blocks, isLoading } = useQuery({
    queryKey: ["completed-blocks-page", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("blocks")
        .select("id, title, goal_id, heat, brick_color, completed_at")
        .eq("completed_by", profile!.id)
        .is("deleted_at", null)
        .order("heat", { ascending: false });
      if (!data?.length) return [];
      const goalIds = Array.from(new Set(data.map((b) => b.goal_id).filter(Boolean) as string[]));
      const { data: goals } = await supabase.from("goals").select("id, title").in("id", goalIds);
      const goalMap = new Map((goals ?? []).map((g) => [g.id, g.title]));
      return data.map((b) => ({ ...b, missionTitle: goalMap.get(b.goal_id ?? "") ?? "Unknown Mission" }));
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

        <h1 className="text-xl font-bold font-mono mb-1">Completed Blocks</h1>
        <p className="text-sm text-muted-foreground font-mono mb-8">
          {isLoading ? "Loading…" : `${blocks?.length ?? 0} blocks completed`}
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : blocks && blocks.length > 0 ? (
          <div className="space-y-2">
            {blocks.map((b) => (
              <Link
                key={b.id}
                to={`/mission/${b.goal_id}/block/${b.id}`}
                className="flex items-center gap-0 rounded-lg border bg-card overflow-hidden hover:bg-muted/50 transition-colors group"
              >
                <div
                  className="w-1 self-stretch shrink-0"
                  style={{ backgroundColor: b.brick_color ?? "#94a3b8" }}
                />
                <div className="flex-1 flex items-center justify-between px-4 py-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium font-mono truncate">{b.title}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{b.missionTitle}</p>
                    {b.completed_at && (
                      <p className="text-xs text-muted-foreground/60 font-mono mt-0.5">
                        {new Date(b.completed_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-3" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground font-mono">No completed blocks yet.</p>
        )}
      </main>
    </>
  );
}

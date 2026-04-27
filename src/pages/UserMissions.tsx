import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ArrowLeft, ArrowRight, Globe, Lock } from "lucide-react";

export default function UserMissions() {
  const { username } = useParams<{ username: string }>();

  const { data: profile } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("username", username!).maybeSingle();
      return data;
    },
    enabled: !!username,
  });

  const { data: missions, isLoading } = useQuery({
    queryKey: ["user-missions-page", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("mission_followers")
        .select("goal_id, goals(id, title, description, visibility, created_at)")
        .eq("user_id", profile!.id);
      return (data ?? []).map((r: any) => r.goals).filter(Boolean);
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

        <h1 className="text-xl font-bold font-mono mb-1">Missions</h1>
        <p className="text-sm text-muted-foreground font-mono mb-8">
          {isLoading ? "Loading…" : `${missions?.length ?? 0} missions`}
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : missions && missions.length > 0 ? (
          <div className="space-y-2">
            {missions.map((m: any) => (
              <Link
                key={m.id}
                to={`/mission/${m.id}`}
                className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium font-mono truncate">{m.title}</span>
                  {m.visibility === "private" ? (
                    <Lock className="w-3 h-3 text-muted-foreground shrink-0" />
                  ) : (
                    <Globe className="w-3 h-3 text-emerald-600 shrink-0" />
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground font-mono">Not following any missions yet.</p>
        )}
      </main>
    </>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { getAvatarUrl } from "@/hooks/use-auth";
import { Search, User, Target, MessageSquare } from "lucide-react";

type Tab = "all" | "users" | "missions" | "discussions";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  const trimmed = query.trim();

  const { data: users } = useQuery({
    queryKey: ["search-users", trimmed],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, avatar_seed, location, about")
        .ilike("username", `%${trimmed}%`)
        .limit(10);
      return data ?? [];
    },
    enabled: trimmed.length >= 1,
  });

  const { data: missions } = useQuery({
    queryKey: ["search-missions", trimmed],
    queryFn: async () => {
      const { data } = await supabase
        .from("goals")
        .select("id, title, description, visibility, created_by")
        .ilike("title", `%${trimmed}%`)
        .is("deleted_at", null)
        .neq("visibility", "private")
        .limit(10);
      return data ?? [];
    },
    enabled: trimmed.length >= 1,
  });

  const { data: discussions } = useQuery({
    queryKey: ["search-discussions", trimmed],
    queryFn: async () => {
      const { data } = await supabase
        .from("discussions")
        .select("id, content, goal_id, user_id, created_at")
        .ilike("content", `%${trimmed}%`)
        .is("parent_id", null)
        .limit(10);
      return data ?? [];
    },
    enabled: trimmed.length >= 1,
  });

  const hasResults =
    (users?.length ?? 0) + (missions?.length ?? 0) + (discussions?.length ?? 0) > 0;

  const tabs: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { id: "all", label: "All", icon: Search, count: (users?.length ?? 0) + (missions?.length ?? 0) + (discussions?.length ?? 0) },
    { id: "users", label: "People", icon: User, count: users?.length ?? 0 },
    { id: "missions", label: "Missions", icon: Target, count: missions?.length ?? 0 },
    { id: "discussions", label: "Discussions", icon: MessageSquare, count: discussions?.length ?? 0 },
  ];

  const showUsers = tab === "all" || tab === "users";
  const showMissions = tab === "all" || tab === "missions";
  const showDiscussions = tab === "all" || tab === "discussions";

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-10 animate-fade-in-up">
        <h1 className="text-xl font-bold font-mono mb-6">Search</h1>

        {/* Search input */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, missions, discussions…"
            className="pl-9 font-mono text-sm"
          />
        </div>

        {/* Tabs — only show when there's a query */}
        {trimmed.length >= 1 && (
          <div className="flex items-center gap-1 mb-6 border-b border-border pb-0">
            {tabs.map(({ id, label, count }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-3 py-2 text-xs font-mono transition-colors border-b-2 -mb-px ${
                  tab === id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className="ml-1.5 text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{count}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {trimmed.length === 0 && (
          <p className="text-sm text-muted-foreground font-mono text-center mt-16">
            Start typing to search across Substrate
          </p>
        )}

        {trimmed.length >= 1 && !hasResults && (
          <p className="text-sm text-muted-foreground font-mono text-center mt-16">
            No results for "{trimmed}"
          </p>
        )}

        <div className="space-y-6">

          {/* ── People ───────────────────────────────────────────────────── */}
          {showUsers && (users?.length ?? 0) > 0 && (
            <section>
              {tab === "all" && (
                <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">People</h2>
              )}
              <div className="space-y-1">
                {users!.map((u) => (
                  <Link
                    key={u.id}
                    to={`/profile/${u.username}`}
                    className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted transition-colors group"
                  >
                    <img
                      src={(u as any).avatar_url || getAvatarUrl(u.avatar_seed)}
                      alt={u.username}
                      className="w-9 h-9 rounded-full bg-muted object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold font-mono">@{u.username}</p>
                      {(u as any).location && (
                        <p className="text-xs text-muted-foreground font-mono truncate">{(u as any).location}</p>
                      )}
                      {!(u as any).location && (u as any).about && (
                        <p className="text-xs text-muted-foreground font-mono truncate">{(u as any).about}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Missions ─────────────────────────────────────────────────── */}
          {showMissions && (missions?.length ?? 0) > 0 && (
            <section>
              {tab === "all" && (
                <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Missions</h2>
              )}
              <div className="space-y-1">
                {missions!.map((m) => (
                  <Link
                    key={m.id}
                    to={`/mission/${m.id}`}
                    className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Target className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold font-mono truncate">{m.title}</p>
                      {m.description && (
                        <p className="text-xs text-muted-foreground font-mono truncate">{m.description}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Discussions ───────────────────────────────────────────────── */}
          {showDiscussions && (discussions?.length ?? 0) > 0 && (
            <section>
              {tab === "all" && (
                <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Discussions</h2>
              )}
              <div className="space-y-1">
                {discussions!.map((d) => (
                  <Link
                    key={d.id}
                    to={`/mission/${d.goal_id}`}
                    className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono line-clamp-2 text-foreground">{d.content}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

        </div>
      </main>
    </>
  );
}

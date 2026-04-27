import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { getAvatarUrl } from "@/hooks/use-auth";
import { useUserFollowedMissions } from "@/hooks/use-mission-followers";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, ArrowRight, Globe, Lock, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const { user, profile: authProfile } = useAuthContext();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [pledgesOpen, setPledgesOpen] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username!)
        .maybeSingle();
      return data;
    },
    enabled: !!username,
  });

  const isOwn = !!user && !!profile && user.id === profile.id;

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", profile?.id],
    queryFn: async () => {
      const [missions, blocks, posts, completed] = await Promise.all([
        supabase.from("goals").select("id", { count: "exact", head: true }).eq("created_by", profile!.id),
        supabase.from("blocks").select("id", { count: "exact", head: true }).eq("created_by", profile!.id).is("deleted_at", null),
        supabase.from("discussions").select("id", { count: "exact", head: true }).eq("user_id", profile!.id).is("parent_id", null),
        supabase.from("blocks").select("id", { count: "exact", head: true }).eq("completed_by", profile!.id).is("deleted_at", null),
      ]);
      return {
        missions: missions.count ?? 0,
        blocks: blocks.count ?? 0,
        posts: posts.count ?? 0,
        completed: completed.count ?? 0,
      };
    },
    enabled: !!profile?.id,
  });

  const { data: completedBlocks } = useQuery({
    queryKey: ["profile-completed", profile?.id],
    queryFn: async () => {
      const { data: blocks } = await supabase
        .from("blocks")
        .select("id, title, goal_id, heat, brick_color, completed_at")
        .eq("completed_by", profile!.id)
        .is("deleted_at", null)
        .order("heat", { ascending: false });
      if (!blocks?.length) return [];
      const goalIds = Array.from(new Set(blocks.map((b) => b.goal_id).filter(Boolean) as string[]));
      const { data: goals } = await supabase.from("goals").select("id, title").in("id", goalIds);
      const goalMap = new Map((goals ?? []).map((g) => [g.id, g.title]));
      return blocks.map((b) => ({ ...b, mission_title: goalMap.get(b.goal_id ?? "") ?? "Unknown mission" }));
    },
    enabled: !!profile?.id,
  });

  const { data: pledgedBlocks } = useQuery({
    queryKey: ["profile-pledges", profile?.id],
    queryFn: async () => {
      const { data: pledges } = await supabase
        .from("block_pledges")
        .select("id, block_id")
        .eq("user_id", profile!.id)
        .eq("active", true);
      if (!pledges?.length) return [];
      const blockIds = pledges.map((p) => p.block_id);
      const { data: blocks } = await supabase
        .from("blocks")
        .select("id, title, goal_id, heat, status")
        .in("id", blockIds)
        .is("deleted_at", null);
      if (!blocks?.length) return [];
      const goalIds = Array.from(new Set(blocks.map((b) => b.goal_id).filter(Boolean) as string[]));
      const { data: goals } = await supabase.from("goals").select("id, title").in("id", goalIds);
      const goalMap = new Map((goals ?? []).map((g) => [g.id, g.title]));
      const { data: allPledges } = await supabase
        .from("block_pledges").select("block_id").in("block_id", blockIds).eq("active", true);
      const pledgeCount: Record<string, number> = {};
      (allPledges ?? []).forEach((p) => { pledgeCount[p.block_id] = (pledgeCount[p.block_id] ?? 0) + 1; });
      return blocks.map((b) => ({
        ...b,
        missionTitle: goalMap.get(b.goal_id ?? "") ?? "Unknown Mission",
        pledgeCount: pledgeCount[b.id] ?? 1,
        pledgeId: pledges.find((p) => p.block_id === b.id)?.id,
      }));
    },
    enabled: !!profile?.id,
  });

  const unpledge = useMutation({
    mutationFn: async (pledgeId: string) => {
      const { error } = await supabase
        .from("block_pledges")
        .update({ active: false, unpledged_at: new Date().toISOString() })
        .eq("id", pledgeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-pledges", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-stats", profile?.id] });
      toast.success("Unpledged");
    },
    onError: () => toast.error("Failed to unpledge"),
  });

  const { data: followedMissions } = useUserFollowedMissions(profile?.id);

  const updateUsername = useMutation({
    mutationFn: async (uname: string) => {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", uname)
        .neq("id", user!.id)
        .maybeSingle();
      if (existing) throw new Error("Username is already taken");
      const { error } = await supabase.from("profiles").update({ username: uname }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Username updated");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <div className="mx-auto max-w-5xl px-6 py-16 text-center text-muted-foreground font-mono text-sm">Loading…</div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <AppHeader />
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <h1 className="text-xl font-semibold font-mono mb-2">User not found</h1>
          <p className="text-muted-foreground text-sm">No user with the username "{username}" exists.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center gap-5 mb-8">
          <img
            src={profile.avatar_url || getAvatarUrl(profile.avatar_seed)}
            alt={profile.username}
            className="w-20 h-20 rounded-full bg-muted"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-mono truncate">{profile.username}</h1>
              {isOwn && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setNewUsername(profile.username); setEditOpen(true); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              Joined {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Missions", value: stats?.missions ?? 0, clickable: false },
            { label: "Blocks", value: stats?.blocks ?? 0, clickable: false },
            { label: "Completed", value: stats?.completed ?? 0, clickable: false },
            { label: "Posts", value: stats?.posts ?? 0, clickable: false },
            { label: "Pledged", value: pledgedBlocks?.length ?? 0, clickable: true },
          ].map((s) => (
            <Card
              key={s.label}
              onClick={s.clickable ? () => setPledgesOpen((o) => !o) : undefined}
              className={s.clickable ? "cursor-pointer hover:border-orange-400 transition-colors select-none" : ""}
            >
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold font-mono">{s.value}</div>
                <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide flex items-center justify-center gap-1">
                  {s.label}
                  {s.clickable && (pledgesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Completed blocks */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wide text-muted-foreground mb-3">Completed Blocks</h2>
          {completedBlocks && completedBlocks.length > 0 ? (
            <div className="space-y-2">
              {completedBlocks.map((b) => (
                <Link
                  key={b.id}
                  to={`/mission/${b.goal_id}/block/${b.id}`}
                  className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors group border-l-4"
                  style={{ borderLeftColor: b.brick_color || "hsl(var(--primary))" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium font-mono truncate">{b.title}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                      {b.mission_title}
                      {b.completed_at && (
                        <span> · {new Date(b.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-3" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground font-mono">No completed blocks yet.</p>
          )}
        </div>

        {/* Pledged blocks panel */}
        {pledgesOpen && (
          <div className="mb-8 animate-fade-in-up">
            <h2 className="text-sm font-semibold font-mono uppercase tracking-wide text-muted-foreground mb-3">Pledged Blocks</h2>
            {pledgedBlocks && pledgedBlocks.length > 0 ? (
              <div className="space-y-2">
                {pledgedBlocks.map((b: any) => (
                  <div
                    key={b.id}
                    className="relative overflow-hidden rounded-lg border border-slate-700 p-4"
                    style={{ background: "#0a0f1e" }}
                  >
                    {/* star dots */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
                      {Array.from({ length: 18 }, (_, i) => (
                        <circle
                          key={i}
                          cx={`${(i * 137.5) % 100}%`}
                          cy={`${(i * 79.3) % 100}%`}
                          r={i % 3 === 0 ? 1.5 : 1}
                          fill="white"
                          opacity={0.3 + (i % 5) * 0.1}
                        />
                      ))}
                    </svg>
                    <div className="relative z-10 flex items-start justify-between gap-3">
                      <Link to={`/mission/${b.goal_id}/block/${b.id}`} className="flex-1 min-w-0 group">
                        <p className="text-sm font-semibold font-mono text-white truncate group-hover:text-orange-300 transition-colors">{b.title}</p>
                        <p className="text-xs font-mono text-slate-400 mt-0.5 truncate">{b.missionTitle}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs font-mono text-slate-500">heat <span className="text-slate-300">{b.heat}</span></span>
                          <span className="text-xs font-mono text-slate-500"><span className="text-slate-300">{b.pledgeCount}</span> pledging</span>
                        </div>
                      </Link>
                      {isOwn && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-slate-400 hover:text-red-400 hover:bg-red-400/10 shrink-0 h-7 px-2"
                          disabled={unpledge.isPending}
                          onClick={() => b.pledgeId && unpledge.mutate(b.pledgeId)}
                        >
                          Unpledge
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-mono">No active pledges.</p>
            )}
          </div>
        )}

        {/* Followed missions */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold font-mono uppercase tracking-wide text-muted-foreground mb-3">Missions</h2>
          {followedMissions && followedMissions.length > 0 ? (
            <div className="space-y-2">
              {followedMissions.map((m: any) => (
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
            <p className="text-sm text-muted-foreground font-mono">Not following any missions.</p>
          )}
        </div>
      </main>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Username</label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="mt-1" />
            </div>
            {user?.email && (
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Email</label>
                <p className="text-sm font-mono mt-1">{user.email}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              disabled={!newUsername.trim() || newUsername === profile.username || updateUsername.isPending}
              onClick={() => updateUsername.mutate(newUsername.trim())}
            >
              {updateUsername.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

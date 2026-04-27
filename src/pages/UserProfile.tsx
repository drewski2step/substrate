import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { getAvatarUrl } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");


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

  const { data: pledgeCount } = useQuery({
    queryKey: ["profile-pledge-count", profile?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("block_pledges")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile!.id)
        .eq("active", true);
      return count ?? 0;
    },
    enabled: !!profile?.id,
  });

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Missions", value: stats?.missions ?? 0, to: `/profile/${profile.username}/missions` },
            { label: "Discussions", value: stats?.posts ?? 0, to: `/profile/${profile.username}/discussions` },
            { label: "Completed", value: stats?.completed ?? 0, to: `/profile/${profile.username}/completed` },
            { label: "Pledged", value: pledgeCount ?? 0, to: `/profile/${profile.username}/pledged` },
          ].map((s) => (
            <Link key={s.label} to={s.to}>
              <Card className="cursor-pointer hover:border-orange-400 transition-colors">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold font-mono">{s.value}</div>
                  <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide">{s.label}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
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

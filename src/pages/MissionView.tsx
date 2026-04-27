import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ArrowLeft, Pencil, Trash2, Undo2, Globe, Lock } from "lucide-react";
import { JoinMissionButton } from "@/components/JoinMissionButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useGoal, useUpdateGoal } from "@/hooks/use-goals";
import { useBlocks } from "@/hooks/use-blocks";
import { useLogEdit } from "@/hooks/use-edit-history";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BlockFlowChart } from "@/components/BlockFlowChart";
import { KochFractalMap } from "@/components/KochFractalMap";
import { MissionFeed } from "@/components/MissionFeed";

import { useRealtimeSync } from "@/hooks/use-realtime";
import { RealtimeIndicator } from "@/components/RealtimeIndicator";
import { toast } from "sonner";

export default function MissionView() {
  const navigate = useNavigate();
  const { missionId } = useParams<{ missionId: string }>();
  const { data: goal, isLoading: goalLoading } = useGoal(missionId || "");
  const { data: blocks, isLoading: blocksLoading } = useBlocks(missionId || "");
  const updateGoal = useUpdateGoal();
  const logEdit = useLogEdit();
  const { user } = useAuth();
  const { connected } = useRealtimeSync(missionId || "");
  const creatorId = goal?.created_by;
  const { data: creatorProfile } = useQuery({
    queryKey: ["profile", creatorId],
    queryFn: async () => {
      if (!creatorId) return null;
      const { data } = await supabase.from("profiles").select("id, username, avatar_seed").eq("id", creatorId).maybeSingle();
      return data;
    },
    enabled: !!creatorId,
  });
  const isLoading = goalLoading || blocksLoading;

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editVisibility, setEditVisibility] = useState("");

  const topLevelBlocks = useMemo(() => blocks?.filter((b) => !b.parent_block_id) || [], [blocks]);
  const completeCount = topLevelBlocks.filter((b) => b.status === "complete").length;
  const total = topLevelBlocks.length;
  const pct = total > 0 ? Math.round((completeCount / total) * 100) : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <Skeleton className="h-6 w-64 mb-2" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="flex gap-3 flex-wrap">{[1, 2, 3].map((i) => <Skeleton key={i} className="w-48 h-20 rounded-lg" />)}</div>
        </main>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-muted-foreground">Mission not found.</p>
        </main>
      </div>
    );
  }

  // Check if soft-deleted
  if (goal.deleted_at) {
    const deletedAt = new Date(goal.deleted_at);
    const hoursAgo = (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60);
    const canUndo = hoursAgo < 24;

    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-12 text-center">
          <p className="text-muted-foreground mb-4">This mission has been deleted.</p>
          {canUndo && user && (
            <Button
              variant="outline" className="gap-1.5"
              onClick={() => {
                updateGoal.mutate({ id: goal.id, updates: { deleted_at: null } }, {
                  onSuccess: () => toast.success("Mission restored"),
                  onError: (err: any) => toast.error(err.message),
                });
              }}
            >
              <Undo2 className="w-3.5 h-3.5" /> Undo deletion
            </Button>
          )}
        </main>
      </div>
    );
  }

  const startEditing = () => {
    setEditTitle(goal.title);
    setEditDesc(goal.description || "");
    setEditVisibility(goal.visibility);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!user || !editTitle.trim()) return;
    const changes: { field: string; old: string | null; new_val: string | null }[] = [];
    if (editTitle.trim() !== goal.title) changes.push({ field: "title", old: goal.title, new_val: editTitle.trim() });
    if (editDesc.trim() !== (goal.description || "")) changes.push({ field: "description", old: goal.description, new_val: editDesc.trim() || null });
    if (editVisibility !== goal.visibility) changes.push({ field: "visibility", old: goal.visibility, new_val: editVisibility });

    for (const c of changes) {
      await logEdit.mutateAsync({ entity_type: "goal", entity_id: goal.id, changed_by: user.id, field_changed: c.field, old_value: c.old, new_value: c.new_val });
    }

    const updates: any = {};
    if (editTitle.trim() !== goal.title) updates.title = editTitle.trim();
    if (editDesc.trim() !== (goal.description || "")) updates.description = editDesc.trim() || null;
    if (editVisibility !== goal.visibility) updates.visibility = editVisibility;

    if (Object.keys(updates).length > 0) {
      updateGoal.mutate({ id: goal.id, updates }, {
        onSuccess: () => { setEditing(false); toast.success("Mission updated"); },
        onError: (err: any) => toast.error(err.message),
      });
    } else {
      setEditing(false);
    }
  };

  const handleDelete = () => {
    if (!user) return;
    if (goal.created_by !== user.id) {
      toast.error("Only the mission owner can delete this mission.");
      return;
    }
    logEdit.mutate({ entity_type: "goal", entity_id: goal.id, changed_by: user.id, field_changed: "deleted_at", old_value: null, new_value: new Date().toISOString() });
    updateGoal.mutate({ id: goal.id, updates: { deleted_at: new Date().toISOString() } as any }, {
      onSuccess: () => { toast.success("Mission deleted. You can undo this within 24 hours."); navigate("/"); },
      onError: (err: any) => toast.error(err.message),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-6 font-mono">
            <ArrowLeft className="w-3 h-3" /> Missions
          </Link>

          {editing ? (
            <div className="space-y-3 mb-4">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-lg font-semibold" />
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" className="text-sm" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">Visibility:</span>
                <Button
                  type="button" size="sm" variant={editVisibility === "public" ? "default" : "outline"}
                  className="gap-1 h-7 text-xs"
                  onClick={() => setEditVisibility("public")}
                >
                  <Globe className="w-3 h-3" /> Public
                </Button>
                <Button
                  type="button" size="sm" variant={editVisibility === "private" ? "default" : "outline"}
                  className="gap-1 h-7 text-xs"
                  onClick={() => setEditVisibility("private")}
                >
                  <Lock className="w-3 h-3" /> Private
                </Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={!editTitle.trim()}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold leading-tight">{goal.title}</h1>
                {goal.visibility === "private" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Lock className="w-3 h-3" /> Private
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                    <Globe className="w-3 h-3" /> Public
                  </span>
                )}
                <JoinMissionButton goalId={goal.id} />
                {user && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={startEditing}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {goal.created_by === user.id && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this mission?</AlertDialogTitle>
                            <AlertDialogDescription>Are you sure you want to delete this mission and all its blocks? This can be undone within 24 hours.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                )}
              </div>
              {goal.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{goal.description}</p>}
              {creatorProfile && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  Created by{" "}
                  <Link to={`/profile/${creatorProfile.username}`} className="text-primary hover:underline">
                    {creatorProfile.username}
                  </Link>
                </p>
              )}
            </>
          )}

          <div className="flex items-center gap-3 mt-4">
            <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums font-mono">{pct}% complete</span>
          </div>
        </div>

        <div className="mt-10 animate-fade-in-up-delay-1">
          <div className="flex items-center justify-between mb-2">
            <div />
            <RealtimeIndicator connected={connected} />
          </div>
          <Tabs defaultValue="flowchart">
            <TabsList>
              <TabsTrigger value="flowchart">Block Flow</TabsTrigger>
              <TabsTrigger value="fractal">Fractal Map</TabsTrigger>
              <TabsTrigger value="feed">Discussions</TabsTrigger>
            </TabsList>
            <TabsContent value="flowchart" className="mt-4">
              <BlockFlowChart
                goalId={goal.id}
                parentBlockId={null}
                parentBlockTitle={goal.title}
                onNavigateToBlock={(b) => navigate(`/mission/${missionId}/block/${b.id}`)}
              />
            </TabsContent>
            <TabsContent value="fractal" className="mt-4">
              <KochFractalMap missionId={goal.id} />
            </TabsContent>
            <TabsContent value="feed" className="mt-4">
              <MissionFeed goalId={goal.id} missionId={missionId || ""} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

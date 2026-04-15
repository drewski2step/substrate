import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, ChevronLeft, Flame, Star, FolderOpen, Pencil, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGoal } from "@/hooks/use-goals";
import { useBlocks, useUpdateBlock, useDeleteBlock } from "@/hooks/use-blocks";
import { useBlockAncestors } from "@/hooks/use-block-ancestors";
import { BlockFlowChart } from "@/components/BlockFlowChart";
import { DiscussionPanel } from "@/components/DiscussionPanel";

import { useRealtimeSync } from "@/hooks/use-realtime";
import { RealtimeIndicator } from "@/components/RealtimeIndicator";
import { useBlockPledges, usePledgeBlock, useUnpledgeBlock } from "@/hooks/use-pledges";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const statusLabel: Record<string, string> = { pending: "Pending", active: "Active", complete: "Complete", stalled: "Stalled" };
const statusColor: Record<string, string> = {
  pending: "bg-substrate-open/10 text-substrate-open border-substrate-open/20",
  active: "bg-substrate-active/10 text-substrate-active border-substrate-active/20",
  complete: "bg-muted text-muted-foreground border-border",
  stalled: "bg-substrate-blocked/10 text-substrate-blocked border-substrate-blocked/20",
};

export default function BlockView() {
  const [editingBlock, setEditingBlock] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editRecurrence, setEditRecurrence] = useState("");
  const navigate = useNavigate();
  const { missionId, blockId, taskId } = useParams<{ missionId: string; blockId?: string; taskId?: string }>();
  const resolvedBlockId = blockId || taskId || "";
  const { data: goal, isLoading: goalLoading } = useGoal(missionId || "");
  const { data: blocks, isLoading: blocksLoading } = useBlocks(missionId || "");
  const { data: ancestors, isLoading: ancestorsLoading } = useBlockAncestors(resolvedBlockId);
  const updateBlock = useUpdateBlock();
  const { user } = useAuth();
  const { connected } = useRealtimeSync(missionId || "");
  const { data: pledges } = useBlockPledges(resolvedBlockId);
  const pledgeBlock = usePledgeBlock();
  const unpledgeBlock = useUnpledgeBlock();
  const userPledged = pledges?.some((p) => p.user_id === user?.id);
  const deleteBlock = useDeleteBlock();

  const creatorId = blocks?.find((b) => b.id === resolvedBlockId)?.created_by;
  const { data: creatorProfile } = useQuery({
    queryKey: ["profile", creatorId],
    queryFn: async () => {
      if (!creatorId) return null;
      const { data } = await supabase.from("profiles").select("id, username, avatar_seed").eq("id", creatorId).maybeSingle();
      return data;
    },
    enabled: !!creatorId,
  });

  const isLoading = goalLoading || blocksLoading || ancestorsLoading;
  const block = blocks?.find((b) => b.id === resolvedBlockId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-7xl px-6 py-12">
          <Skeleton className="h-4 w-48 mb-6" />
          <Skeleton className="h-6 w-64 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3"><Skeleton className="h-64 w-full rounded-lg" /></div>
            <div className="lg:col-span-2"><Skeleton className="h-64 w-full rounded-lg" /></div>
          </div>
        </main>
      </div>
    );
  }

  if (!goal || !block) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-7xl px-6 py-12">
          <p className="text-muted-foreground">Block not found.</p>
          <Link to={missionId ? `/mission/${missionId}` : "/"} className="text-xs text-primary hover:underline mt-2 inline-block font-mono">← Back</Link>
        </main>
      </div>
    );
  }

  const status = block.status || "pending";
  const canComplete = status === "pending" || status === "active";
  const parentBlockId = block.parent_block_id;
  const heat = block.heat || 0;

  const backUrl = parentBlockId
    ? `/mission/${missionId}/block/${parentBlockId}`
    : `/mission/${missionId}`;
  const backLabel = parentBlockId
    ? ancestors?.find((a) => a.id === parentBlockId)?.title || "Parent Block"
    : goal.title;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 font-mono">
          <Link to={`/mission/${missionId}`} className="hover:underline">{goal.title}</Link>
          <span>&gt;</span>
          {ancestors && ancestors.filter(a => a.id !== block.id).map((a) => (
            <span key={a.id} className="flex items-center gap-2">
              <Link to={`/mission/${missionId}/block/${a.id}`} className="hover:underline">{a.title}</Link>
              <span>&gt;</span>
            </span>
          ))}
          <span className="text-foreground font-semibold">{block.title}</span>
        </div>

        {/* Title row */}
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold">{block.title}</h1>
          {user && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingBlock(true)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          <span className={cn("inline-flex items-center px-3 py-1 text-xs font-medium rounded border", statusColor[status] || statusColor.pending)}>
            {statusLabel[status] || status}
          </span>
          {heat > 0 && (
            <span className="inline-flex items-center gap-1 text-sm font-mono tabular-nums text-orange-500">
              <Flame className="w-4 h-4" />{heat}
            </span>
          )}
          <RealtimeIndicator connected={connected} />
        </div>

        {block.description && <p className="text-sm text-muted-foreground mb-2 max-w-2xl">{block.description}</p>}
        
        {/* Deadline & recurrence info */}
        <div className="flex items-center gap-3 mb-2">
          {(block as any).deadline_at && (
            <span className={cn("inline-flex items-center gap-1 text-xs font-mono",
              new Date((block as any).deadline_at) < new Date() ? "text-red-500" : "text-muted-foreground"
            )}>
              <Calendar className="w-3.5 h-3.5" />
              Deadline: {new Date((block as any).deadline_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
          {(block as any).recurrence_interval && (
            <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Recurs {(block as any).recurrence_interval}
            </span>
          )}
        </div>

        {creatorProfile && (
          <p className="text-xs text-muted-foreground mb-4 font-mono">
            Created by{" "}
            <Link to={`/profile/${creatorProfile.username}`} className="text-primary hover:underline">
              {creatorProfile.username}
            </Link>
          </p>
        )}
        {!creatorProfile && <div className="mb-4" />}

        {/* Actions */}
        <div className="flex items-center gap-3 mb-8">
          {canComplete && (
            <Button onClick={() => {
              updateBlock.mutate({ id: block.id, goalId: goal.id, updates: { status: "complete" } },
                { onError: (err: any) => toast.error(err.message) });
            }}>Mark complete</Button>
          )}
          {status === "complete" && (
            <Button variant="outline" onClick={() => {
              updateBlock.mutate({ id: block.id, goalId: goal.id, updates: { status: "pending" } },
                { onError: (err: any) => toast.error(err.message) });
            }}>Reopen block</Button>
          )}
          {user && (
            <Button
              variant={userPledged ? "default" : "outline"}
              className={cn("gap-1.5", userPledged && "bg-indigo-600 hover:bg-indigo-700")}
              onClick={() => {
                if (userPledged) unpledgeBlock.mutate({ blockId: block.id, userId: user.id });
                else pledgeBlock.mutate({ blockId: block.id, userId: user.id });
              }}
            >
              <Star className="w-4 h-4" /> {userPledged ? "Pledged" : "Pledge"}
            </Button>
          )}
          {user && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
                  <Trash2 className="w-4 h-4" /> Delete block
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this block?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently remove the block, all its child blocks, and chat messages.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      deleteBlock.mutate({ id: block.id, goalId: goal.id, userId: user?.id }, {
                        onSuccess: () => navigate(backUrl),
                        onError: (err: any) => toast.error(err.message),
                      });
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <Tabs defaultValue="flow" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="flow">Block Flow</TabsTrigger>
            <TabsTrigger value="discussions">Discussions</TabsTrigger>
          </TabsList>
          <TabsContent value="flow" className="mt-4">
            <BlockFlowChart
              goalId={goal.id}
              parentBlockId={block.id}
              parentBlockTitle={block.title}
              onNavigateToBlock={(b) => navigate(`/mission/${missionId}/block/${b.id}`)}
            />
          </TabsContent>
          <TabsContent value="discussions" className="mt-4">
            <DiscussionPanel blockId={block.id} goalId={goal.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

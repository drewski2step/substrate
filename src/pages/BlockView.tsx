import { useParams, Link, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, ChevronLeft, Flame, Star, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGoal } from "@/hooks/use-goals";
import { useBlocks, useUpdateBlock, useDeleteBlock } from "@/hooks/use-blocks";
import { useBlockAncestors } from "@/hooks/use-block-ancestors";
import { BlockFlowChart } from "@/components/BlockFlowChart";
import { BlockChatPanel } from "@/components/BlockChatPanel";
import { DiscussionPanel } from "@/components/DiscussionPanel";

import { useRealtimeSync } from "@/hooks/use-realtime";
import { RealtimeIndicator } from "@/components/RealtimeIndicator";
import { useBlockPledges, usePledgeBlock, useUnpledgeBlock } from "@/hooks/use-pledges";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const statusLabel: Record<string, string> = { pending: "Pending", active: "Active", complete: "Complete", stalled: "Stalled" };
const statusColor: Record<string, string> = {
  pending: "bg-substrate-open/10 text-substrate-open border-substrate-open/20",
  active: "bg-substrate-active/10 text-substrate-active border-substrate-active/20",
  complete: "bg-muted text-muted-foreground border-border",
  stalled: "bg-substrate-blocked/10 text-substrate-blocked border-substrate-blocked/20",
};

export default function BlockView() {
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

      {/* Sticky block header */}
      <div className="sticky top-0 z-30 bg-background border-b border-border">
        <div className="mx-auto max-w-7xl px-6">
          {/* Back navigation button styled like a block */}
          <div className="py-3 flex items-center justify-between">
            <button
              onClick={() => navigate(backUrl)}
              className="inline-flex items-center gap-2 border-2 border-border rounded-lg px-4 py-2 hover:bg-muted/50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{block.title}</span>
              <span className={cn("inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded border ml-1", statusColor[status] || statusColor.pending)}>
                {statusLabel[status] || status}
              </span>
              {heat > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-mono tabular-nums text-orange-500">
                  <Flame className="w-3.5 h-3.5" />{heat}
                </span>
              )}
            </button>
            <div className="flex items-center gap-2">
              {canComplete && (
                <Button size="sm" onClick={() => {
                  updateBlock.mutate({ id: block.id, goalId: goal.id, updates: { status: "complete" } },
                    { onError: (err: any) => toast.error(err.message) });
                }}>Mark complete</Button>
              )}
              {user && (
                <Button
                  size="sm"
                  variant={userPledged ? "default" : "outline"}
                  className={cn("gap-1.5", userPledged && "bg-indigo-600 hover:bg-indigo-700")}
                  onClick={() => {
                    if (userPledged) unpledgeBlock.mutate({ blockId: block.id, userId: user.id });
                    else pledgeBlock.mutate({ blockId: block.id, userId: user.id });
                  }}
                >
                  <Star className="w-3.5 h-3.5" /> {userPledged ? "Pledged" : "Pledge"}
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
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
                        deleteBlock.mutate({ id: block.id, goalId: goal.id }, {
                          onSuccess: () => navigate(backUrl),
                          onError: (err: any) => toast.error(err.message),
                        });
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <RealtimeIndicator connected={connected} />
            </div>
          </div>
          {block.description && <p className="text-xs text-muted-foreground pb-2 max-w-2xl">{block.description}</p>}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* Two panels: Flow + Discussion/Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <BlockFlowChart
              goalId={goal.id}
              parentBlockId={block.id}
              parentBlockTitle={block.title}
              onNavigateToBlock={(b) => navigate(`/mission/${missionId}/block/${b.id}`)}
            />
          </div>
          <div className="lg:col-span-2 min-h-[500px]">
            <Tabs defaultValue="discussions" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="discussions">Discussions</TabsTrigger>
                <TabsTrigger value="chat">Chat</TabsTrigger>
              </TabsList>
              <TabsContent value="discussions" className="flex-1 mt-2">
                <DiscussionPanel blockId={block.id} goalId={goal.id} />
              </TabsContent>
              <TabsContent value="chat" className="flex-1 mt-2">
                <BlockChatPanel blockId={block.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}

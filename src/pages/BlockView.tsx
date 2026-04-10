import { useParams, Link, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGoal } from "@/hooks/use-goals";
import { useBlocks, useUpdateBlock, useDeleteBlock } from "@/hooks/use-blocks";
import { useBlockAncestors } from "@/hooks/use-block-ancestors";
import { BlockFlowChart } from "@/components/BlockFlowChart";
import { BlockChatPanel } from "@/components/BlockChatPanel";
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
  const deleteBlock = useDeleteBlock();

  const isLoading = goalLoading || blocksLoading || ancestorsLoading;
  const block = blocks?.find((b) => b.id === resolvedBlockId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-6 py-12">
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
        <main className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-muted-foreground">Block not found.</p>
          <Link to={missionId ? `/mission/${missionId}` : "/"} className="text-xs text-primary hover:underline mt-2 inline-block font-mono">← Back</Link>
        </main>
      </div>
    );
  }

  const status = block.status || "pending";
  const canComplete = status === "pending" || status === "active";
  // Parent block for "back" navigation
  const parentBlockId = block.parent_block_id;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-xs font-mono mb-6 flex-wrap animate-fade-in-up">
          <Link to={`/mission/${missionId}`} className="text-muted-foreground hover:text-primary transition-colors">
            {goal.title}
          </Link>
          {ancestors?.map((anc) => (
            <span key={anc.id} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              {anc.id === resolvedBlockId ? (
                <span className="text-foreground font-medium">{anc.title}</span>
              ) : (
                <Link to={`/mission/${missionId}/block/${anc.id}`} className="text-muted-foreground hover:text-primary transition-colors">
                  {anc.title}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {/* Block header */}
        <div className="flex items-center gap-3 mb-2 animate-fade-in-up">
          <h1 className="text-xl font-semibold leading-tight">{block.title}</h1>
          <span className={cn("inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border", statusColor[status] || statusColor.pending)}>
            {statusLabel[status] || status}
          </span>
        </div>
        {block.description && <p className="text-sm text-muted-foreground mb-4 max-w-2xl">{block.description}</p>}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mb-8">
          {canComplete && (
            <Button size="sm" onClick={() => {
              updateBlock.mutate({ id: block.id, goalId: goal.id, updates: { status: "complete" } },
                { onError: (err: any) => toast.error(err.message) });
            }}>Mark complete</Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete block
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
                      onSuccess: () => {
                        if (parentBlockId) navigate(`/mission/${missionId}/block/${parentBlockId}`);
                        else navigate(`/mission/${missionId}`);
                      },
                      onError: (err: any) => toast.error(err.message),
                    });
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Two panels: Flow + Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 animate-fade-in-up-delay-1">
          <div className="lg:col-span-3">
            <BlockFlowChart
              goalId={goal.id}
              parentBlockId={block.id}
              onNavigateToBlock={(b) => navigate(`/mission/${missionId}/block/${b.id}`)}
            />
          </div>
          <div className="lg:col-span-2 min-h-[400px]">
            <BlockChatPanel blockId={block.id} />
          </div>
        </div>
      </main>
    </div>
  );
}

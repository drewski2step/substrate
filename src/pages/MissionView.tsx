import { useParams, Link, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGoal } from "@/hooks/use-goals";
import { useBlocks } from "@/hooks/use-blocks";
import { BlockFlowChart } from "@/components/BlockFlowChart";
import { MissionFeed } from "@/components/MissionFeed";
import { useMemo } from "react";

export default function MissionView() {
  const navigate = useNavigate();
  const { missionId } = useParams<{ missionId: string }>();
  const { data: goal, isLoading: goalLoading } = useGoal(missionId || "");
  const { data: blocks, isLoading: blocksLoading } = useBlocks(missionId || "");
  const isLoading = goalLoading || blocksLoading;

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
          <p className="text-muted-foreground">Goal not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up">
          <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-6 font-mono">
            <ArrowLeft className="w-3 h-3" /> Goals
          </Link>
          <h1 className="text-2xl font-semibold leading-tight">{goal.title}</h1>
          {goal.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{goal.description}</p>}
          <div className="flex items-center gap-3 mt-4">
            <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums font-mono">{pct}% complete</span>
          </div>
        </div>

        <div className="mt-10 animate-fade-in-up-delay-1">
          <Tabs defaultValue="flowchart">
            <TabsList>
              <TabsTrigger value="flowchart">Block Flow</TabsTrigger>
              <TabsTrigger value="feed">Mission Feed</TabsTrigger>
            </TabsList>
            <TabsContent value="flowchart" className="mt-4">
              <BlockFlowChart
                goalId={goal.id}
                parentBlockId={null}
                onNavigateToBlock={(b) => navigate(`/mission/${missionId}/block/${b.id}`)}
              />
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

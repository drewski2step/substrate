import { Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Globe, Lock, LayoutGrid, Star, Handshake } from "lucide-react";
import { CreateMissionDialog } from "@/components/CreateMissionDialog";
import { useGoals } from "@/hooks/use-goals";
import { useMissionBoardStats } from "@/hooks/use-mission-stats";
import { Skeleton } from "@/components/ui/skeleton";
import { MissionHeatBadge } from "@/components/MissionHeatBadge";
import { JoinMissionButton } from "@/components/JoinMissionButton";
import { useMemo } from "react";

export default function MissionBoard() {
  const { data: goals, isLoading } = useGoals();

  const sortedGoals = useMemo(() => {
    if (!goals) return [];
    return [...goals].sort((a, b) => ((b as any).heat ?? 0) - ((a as any).heat ?? 0));
  }, [goals]);

  const goalIds = useMemo(() => sortedGoals.map((g) => g.id), [sortedGoals]);
  const { data: statsMap } = useMissionBoardStats(goalIds);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Missions</h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono">Active coordination missions on the substrate.</p>
          </div>
          <CreateMissionDialog />
        </div>

        <div className="mt-8 space-y-3 animate-fade-in-up-delay-1">
          {isLoading && (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border rounded-lg p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </>
          )}

          {!isLoading && sortedGoals.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No missions yet. Create one to get started.</p>
            </div>
          )}

          {sortedGoals.map((goal) => {
            const stats = statsMap?.[goal.id];
            const heat = (goal as any).heat ?? 0;
            return (
              <Link
                key={goal.id}
                to={`/mission/${goal.id}`}
                className="block border border-border rounded-lg p-5 hover:bg-card hover:border-primary/30 transition-all group active:scale-[0.995]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                        {goal.title}
                      </h2>
                      <MissionHeatBadge heat={heat} />
                    </div>
                    {goal.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-md">
                        {goal.description}
                      </p>
                    )}
                    {/* Stats row */}
                    <div className="flex items-center gap-4 mt-2">
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                        <LayoutGrid className="w-3 h-3" /> {stats?.blockCount ?? 0} blocks
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                        <Star className="w-3 h-3" /> {stats?.pledgerCount ?? 0} pledging
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                        <Handshake className="w-3 h-3" /> {stats?.followerCount ?? 0} members
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <JoinMissionButton goalId={goal.id} />
                    {goal.visibility === "private" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <Lock className="w-3 h-3" /> Private
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                        <Globe className="w-3 h-3" /> Public
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground capitalize font-mono">{goal.status}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}

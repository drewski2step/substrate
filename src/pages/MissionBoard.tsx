import { Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Globe, Lock } from "lucide-react";
import { CreateMissionDialog } from "@/components/CreateMissionDialog";
import { useGoals } from "@/hooks/use-goals";
import { Skeleton } from "@/components/ui/skeleton";

export default function MissionBoard() {
  const { data: goals, isLoading } = useGoals();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Missions</h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono">Active coordination goals on the substrate.</p>
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

          {!isLoading && goals?.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No missions yet. Create one to get started.</p>
            </div>
          )}

          {goals?.map((goal) => (
            <Link
              key={goal.id}
              to={`/mission/${goal.id}`}
              className="block border border-border rounded-lg p-5 hover:bg-card hover:border-primary/30 transition-all group active:scale-[0.995]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                    {goal.title}
                  </h2>
                  {goal.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-md">
                      {goal.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-muted-foreground capitalize font-mono">{goal.status}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

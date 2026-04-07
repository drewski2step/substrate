import { Link } from "react-router-dom";
import { useSubstrate } from "@/lib/substrate-context";
import { AppHeader } from "@/components/AppHeader";
import { CreateMissionDialog } from "@/components/CreateMissionDialog";

export default function MissionBoard() {
  const { missions, addMission } = useSubstrate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Missions</h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono">Active coordination goals on the substrate.</p>
          </div>
          <CreateMissionDialog onCreateMission={addMission} />
        </div>

        <div className="mt-8 space-y-3 animate-fade-in-up-delay-1">
          {missions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No missions yet. Create one to get started.</p>
            </div>
          )}
          {missions.map((mission) => {
            const total = mission.tasks.length;
            const complete = mission.tasks.filter((t) => t.status === "complete").length;
            const open = mission.tasks.filter((t) => t.status === "open" || t.status === "active").length;
            const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

            return (
              <Link
                key={mission.id}
                to={`/mission/${mission.id}`}
                className="block border border-border rounded-lg p-5 hover:bg-card hover:border-primary/30 transition-all group active:scale-[0.995]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                      {mission.title}
                    </h2>
                    {mission.location && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{mission.location}</p>
                    )}
                    {mission.deadline && (
                      <p className="text-xs text-primary mt-0.5 font-mono">
                        Due: {new Date(mission.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground tabular-nums font-mono">{total > 0 ? `${open} open` : "No traces"}</span>
                    </div>
                    {total > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums w-8 text-right font-mono">{pct}%</span>
                      </div>
                    )}
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

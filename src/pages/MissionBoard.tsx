import { Link } from "react-router-dom";
import { useSubstrate } from "@/lib/substrate-context";
import { AppHeader } from "@/components/AppHeader";

export default function MissionBoard() {
  const { missions } = useSubstrate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-semibold leading-tight">Missions</h1>
          <p className="text-sm text-muted-foreground mt-1">Active coordination goals on the substrate.</p>
        </div>

        <div className="mt-8 space-y-3 animate-fade-in-up-delay-1">
          {missions.map((mission) => {
            const total = mission.tasks.length;
            const complete = mission.tasks.filter((t) => t.status === "complete").length;
            const open = mission.tasks.filter((t) => t.status === "open" || t.status === "active").length;
            const pct = Math.round((complete / total) * 100);

            return (
              <Link
                key={mission.id}
                to={`/mission/${mission.id}`}
                className="block border border-border rounded-lg p-5 hover:bg-card transition-colors group active:scale-[0.995]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="text-sm font-medium group-hover:text-foreground transition-colors truncate">
                      {mission.title}
                    </h2>
                    {mission.location && (
                      <p className="text-xs text-muted-foreground mt-0.5">{mission.location}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground tabular-nums">{open} open</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                    </div>
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

import { Link } from "react-router-dom";
import { useSubstrate } from "@/lib/substrate-context";
import { AppHeader } from "@/components/AppHeader";
import { MapPin, Star, Briefcase, User } from "lucide-react";

export default function AgentList() {
  const { agents } = useSubstrate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-semibold leading-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">Individuals and businesses available on the substrate.</p>
        </div>

        <div className="mt-8 space-y-3 animate-fade-in-up-delay-1">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              to={`/agent/${agent.id}`}
              className="block border border-border rounded-lg p-4 hover:bg-card transition-colors active:scale-[0.998]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  {agent.type === "business" ? (
                    <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{agent.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {agent.location}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {agent.reputationScore}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {agent.completedTasks.length} completed
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

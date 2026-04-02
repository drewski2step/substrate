import { useParams, Link } from "react-router-dom";
import { useSubstrate } from "@/lib/substrate-context";
import { AppHeader } from "@/components/AppHeader";
import { ArrowLeft, MapPin, Star, Briefcase, User } from "lucide-react";

export default function AgentProfile() {
  const { agentId } = useParams<{ agentId: string }>();
  const { getAgent } = useSubstrate();
  const agent = getAgent(agentId || "");

  if (!agent) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <p className="text-muted-foreground">Agent not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="animate-fade-in-up">
          <Link
            to="/agents"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mb-6 font-mono"
          >
            <ArrowLeft className="w-3 h-3" />
            Agents
          </Link>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              {agent.type === "business" ? (
                <Briefcase className="w-4 h-4 text-muted-foreground" />
              ) : (
                <User className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold">{agent.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground capitalize font-mono">{agent.type}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                  <MapPin className="w-3 h-3" />
                  {agent.location}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                  <Star className="w-3 h-3" />
                  {agent.reputationScore} reputation
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 font-mono">Skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {agent.skills.map((skill) => (
                <span key={skill} className="px-2 py-0.5 text-xs bg-muted rounded border border-border font-mono">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 animate-fade-in-up-delay-1">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4 font-mono">
            Completed traces ({agent.completedTasks.length})
          </h3>
          <div className="space-y-2">
            {agent.completedTasks.map((ct) => (
              <div key={ct.taskId} className="border border-border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{ct.taskTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">{ct.missionTitle}</p>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums font-mono">
                    {new Date(ct.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

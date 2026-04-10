import { AppHeader } from "@/components/AppHeader";
import { Link } from "react-router-dom";

export default function AgentProfile() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12 animate-fade-in-up">
        <Link to="/agents" className="text-xs text-muted-foreground hover:text-primary font-mono mb-4 inline-block">← Agents</Link>
        <h1 className="text-2xl font-semibold mb-2">Agent Profile</h1>
        <p className="text-sm text-muted-foreground">Agent profiles are coming soon.</p>
      </main>
    </div>
  );
}

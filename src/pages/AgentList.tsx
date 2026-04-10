import { AppHeader } from "@/components/AppHeader";

export default function AgentList() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12 animate-fade-in-up">
        <h1 className="text-2xl font-semibold mb-2">Agents</h1>
        <p className="text-sm text-muted-foreground">Agent management is coming soon. This feature will allow you to create and manage agents who can claim and work on blocks.</p>
      </main>
    </div>
  );
}

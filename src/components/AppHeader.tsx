import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-6 h-14">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-5 h-5 rounded-sm bg-primary group-hover:scale-95 transition-transform" />
          <span className="text-sm font-semibold tracking-tight font-mono uppercase">Substrate</span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            to="/"
            className={cn(
              "text-sm font-mono transition-colors",
              location.pathname === "/" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Missions
          </Link>
          <Link
            to="/agents"
            className={cn(
              "text-sm font-mono transition-colors",
              location.pathname.startsWith("/agents") ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Agents
          </Link>
        </nav>
      </div>
    </header>
  );
}

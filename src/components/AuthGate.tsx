import { Link } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { LogIn } from "lucide-react";

/**
 * Wraps a write-action trigger. If authenticated, renders children.
 * If not, shows an inline "Join the network" prompt instead.
 */
export function AuthGate({ children, className }: { children?: React.ReactNode; className?: string }) {
  const { user } = useAuthContext();

  if (user) return <>{children}</>;

  return (
    <div className={className}>
      <Link
        to="/signup"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" />
        Join the network to contribute
      </Link>
    </div>
  );
}

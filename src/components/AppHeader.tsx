import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/AuthContext";
import { getAvatarUrl } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";

export function AppHeader() {
  const location = useLocation();
  const { user, profile, signOut } = useAuthContext();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Logged out");
    } catch {
      toast.error("Failed to log out");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-6 h-14">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-5 h-5 rounded-sm bg-primary group-hover:scale-95 transition-transform" />
          <span className="text-sm font-semibold tracking-tight font-mono uppercase">Substrate</span>
        </Link>
        <div className="flex items-center gap-4">
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
          </nav>
          {user && profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full hover:bg-muted/50 pl-2 pr-1 py-1 transition-colors">
                  <span className="text-xs font-medium font-mono hidden sm:block">{profile.username}</span>
                  <img
                    src={profile.avatar_url || getAvatarUrl(profile.avatar_seed)}
                    alt={profile.username}
                    className="w-7 h-7 rounded-full bg-muted"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem asChild>
                  <Link to={`/profile/${profile.username}`} className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2 text-destructive">
                  <LogOut className="w-3.5 h-3.5" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-xs font-mono">Log in</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="text-xs font-mono">Sign up</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

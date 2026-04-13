import { UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/contexts/AuthContext";
import { useMissionFollowers, useFollowMission, useUnfollowMission } from "@/hooks/use-mission-followers";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function JoinMissionButton({ goalId, size = "sm" }: { goalId: string; size?: "sm" | "default" }) {
  const { user } = useAuthContext();
  const { data: followers } = useMissionFollowers(goalId);
  const follow = useFollowMission();
  const unfollow = useUnfollowMission();
  const navigate = useNavigate();

  const isFollowing = !!user && !!followers?.some((f) => f.user_id === user.id);
  const count = followers?.length ?? 0;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate("/signup");
      return;
    }
    if (isFollowing) {
      unfollow.mutate({ goalId, userId: user.id }, {
        onError: (err: any) => toast.error(err.message),
      });
    } else {
      follow.mutate({ goalId, userId: user.id }, {
        onError: (err: any) => toast.error(err.message),
      });
    }
  };

  return (
    <Button
      variant={isFollowing ? "secondary" : "outline"}
      size={size}
      className="gap-1.5 text-xs font-mono"
      onClick={handleClick}
      disabled={follow.isPending || unfollow.isPending}
    >
      {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
      {isFollowing ? "Joined" : "Join"}
      {count > 0 && <span className="text-muted-foreground">· {count}</span>}
    </Button>
  );
}

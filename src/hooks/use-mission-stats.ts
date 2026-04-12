import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MissionStats = {
  goalId: string;
  blockCount: number;
  pledgerCount: number;
  followerCount: number;
};

export function useMissionBoardStats(goalIds: string[]) {
  return useQuery({
    queryKey: ["mission-board-stats", goalIds],
    queryFn: async () => {
      if (!goalIds.length) return {};

      const [blocksRes, pledgesRes, followersRes] = await Promise.all([
        supabase
          .from("blocks")
          .select("id, goal_id")
          .in("goal_id", goalIds)
          .is("deleted_at", null)
          .eq("is_files_block", false),
        supabase
          .from("block_pledges")
          .select("user_id, block_id")
          .eq("active", true),
        supabase
          .from("mission_followers" as any)
          .select("goal_id, user_id")
          .in("goal_id", goalIds),
      ]);

      const blocks = blocksRes.data ?? [];
      const pledges = pledgesRes.data ?? [];
      const followers = followersRes.data ?? [];

      // Get block ids per goal
      const blocksByGoal: Record<string, string[]> = {};
      for (const b of blocks) {
        const gid = (b as any).goal_id;
        if (!blocksByGoal[gid]) blocksByGoal[gid] = [];
        blocksByGoal[gid].push((b as any).id);
      }

      const result: Record<string, MissionStats> = {};
      for (const gid of goalIds) {
        const goalBlockIds = blocksByGoal[gid] ?? [];
        const uniquePledgers = new Set(
          pledges
            .filter((p: any) => goalBlockIds.includes(p.block_id))
            .map((p: any) => p.user_id)
        );
        const followerCount = followers.filter((f: any) => f.goal_id === gid).length;

        result[gid] = {
          goalId: gid,
          blockCount: goalBlockIds.length,
          pledgerCount: uniquePledgers.size,
          followerCount,
        };
      }

      return result;
    },
    enabled: goalIds.length > 0,
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMissionFollowers(goalId: string) {
  return useQuery({
    queryKey: ["mission-followers", goalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_followers" as any)
        .select("*")
        .eq("goal_id", goalId);
      if (error) throw error;
      return data as { id: string; goal_id: string; user_id: string; followed_at: string }[];
    },
    enabled: !!goalId,
  });
}

export function useFollowMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, userId }: { goalId: string; userId: string }) => {
      const { error } = await supabase
        .from("mission_followers" as any)
        .insert({ goal_id: goalId, user_id: userId } as any);
      if (error) throw error;
    },
    onSuccess: (_, { goalId }) => {
      qc.invalidateQueries({ queryKey: ["mission-followers", goalId] });
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useUnfollowMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, userId }: { goalId: string; userId: string }) => {
      const { error } = await supabase
        .from("mission_followers" as any)
        .delete()
        .eq("goal_id", goalId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { goalId }) => {
      qc.invalidateQueries({ queryKey: ["mission-followers", goalId] });
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useUserFollowedMissions(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-followed-missions", userId],
    queryFn: async () => {
      const { data: follows, error } = await supabase
        .from("mission_followers" as any)
        .select("goal_id")
        .eq("user_id", userId!);
      if (error) throw error;
      if (!follows?.length) return [];
      const goalIds = (follows as any[]).map((f) => f.goal_id);
      const { data: goals } = await supabase
        .from("goals")
        .select("*")
        .in("id", goalIds)
        .is("deleted_at", null);
      return goals ?? [];
    },
    enabled: !!userId,
  });
}

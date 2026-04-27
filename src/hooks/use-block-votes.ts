import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useBlockVotes(blockId: string) {
  return useQuery({
    queryKey: ["block-votes", blockId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("block_votes" as any)
        .select("id, user_id, vote")
        .eq("block_id", blockId);
      if (error) throw error;
      return (data ?? []) as { id: string; user_id: string; vote: 1 | -1 }[];
    },
    enabled: !!blockId,
  });
}

export function useVoteBlock() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      blockId,
      userId,
      vote,
      goalId,
      currentVote,
      currentHeat,
    }: {
      blockId: string;
      userId: string;
      vote: 1 | -1;
      goalId: string;
      currentVote: 1 | -1 | null;
      currentHeat: number;
    }) => {
      // Remove vote if clicking same direction again (toggle off)
      if (currentVote === vote) {
        await supabase
          .from("block_votes" as any)
          .delete()
          .eq("block_id", blockId)
          .eq("user_id", userId);
        // Reverse the heat effect
        const { error } = await supabase
          .from("blocks")
          .update({ heat: Math.max(0, currentHeat - vote) } as any)
          .eq("id", blockId);
        if (error) throw error;
        return;
      }

      // Upsert vote
      const { error: voteError } = await supabase
        .from("block_votes" as any)
        .upsert({ block_id: blockId, user_id: userId, vote } as any, {
          onConflict: "block_id,user_id",
        });
      if (voteError) throw voteError;

      // Adjust heat: if switching from opposite vote, delta is 2; new vote, delta is 1
      const delta = currentVote !== null ? vote * 2 : vote;
      const newHeat = Math.max(0, currentHeat + delta);
      const { error: heatError } = await supabase
        .from("blocks")
        .update({ heat: newHeat } as any)
        .eq("id", blockId);
      if (heatError) throw heatError;
    },
    onSuccess: (_, { blockId, goalId }) => {
      qc.invalidateQueries({ queryKey: ["block-votes", blockId] });
      qc.invalidateQueries({ queryKey: ["blocks", goalId] });
    },
  });
}

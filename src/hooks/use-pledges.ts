import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PledgeRow = {
  id: string;
  block_id: string;
  user_id: string;
  pledged_at: string;
  unpledged_at: string | null;
  active: boolean;
};

export function useBlockPledges(blockId: string) {
  return useQuery({
    queryKey: ["pledges", blockId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("block_pledges")
        .select("*")
        .eq("block_id", blockId)
        .eq("active", true);
      if (error) throw error;
      return data as PledgeRow[];
    },
    enabled: !!blockId,
  });
}

export function usePledgeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ blockId, userId }: { blockId: string; userId: string }) => {
      // Upsert: reactivate if exists
      const { data: existing } = await supabase
        .from("block_pledges")
        .select("id, active")
        .eq("block_id", blockId)
        .eq("user_id", userId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("block_pledges")
          .update({ active: true, unpledged_at: null } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("block_pledges")
          .insert({ block_id: blockId, user_id: userId });
        if (error) throw error;
      }

      // +20 heat, +10 signal
      const { data: blk } = await supabase.from("blocks").select("heat, signal_strength").eq("id", blockId).single();
      if (blk) {
        await supabase.from("blocks").update({
          heat: (blk.heat || 0) + 20,
          signal_strength: (blk.signal_strength || 0) + 10,
          heat_updated_at: new Date().toISOString(),
        } as any).eq("id", blockId);
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["pledges", vars.blockId] });
      qc.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}

export function useUnpledgeBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ blockId, userId }: { blockId: string; userId: string }) => {
      const { error } = await supabase
        .from("block_pledges")
        .update({ active: false, unpledged_at: new Date().toISOString() } as any)
        .eq("block_id", blockId)
        .eq("user_id", userId);
      if (error) throw error;

      // -5 heat
      const { data: blk } = await supabase.from("blocks").select("heat").eq("id", blockId).single();
      if (blk) {
        await supabase.from("blocks").update({
          heat: Math.max(0, (blk.heat || 0) - 5),
          heat_updated_at: new Date().toISOString(),
        } as any).eq("id", blockId);
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["pledges", vars.blockId] });
      qc.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}

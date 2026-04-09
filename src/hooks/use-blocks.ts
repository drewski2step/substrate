import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BlockRow = {
  id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  status: string | null;
  signal_strength: number | null;
  created_by: string | null;
  created_at: string | null;
};

export function useBlocks(goalId: string) {
  return useQuery({
    queryKey: ["blocks", goalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocks")
        .select("*")
        .eq("goal_id", goalId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as BlockRow[];
    },
    enabled: !!goalId,
  });
}

export function useCreateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (block: { goal_id: string; title: string; description?: string; status?: string }) => {
      const { data, error } = await supabase
        .from("blocks")
        .insert({
          goal_id: block.goal_id,
          title: block.title,
          description: block.description || null,
          status: block.status || "pending",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["blocks", vars.goal_id] }),
  });
}

export function useUpdateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, goalId, updates }: { id: string; goalId: string; updates: Partial<Pick<BlockRow, "title" | "description" | "status" | "signal_strength">> }) => {
      const { error } = await supabase.from("blocks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["blocks", vars.goalId] }),
  });
}

export function useDeleteBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, goalId }: { id: string; goalId: string }) => {
      const { error } = await supabase.from("blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["blocks", vars.goalId] }),
  });
}

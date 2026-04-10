import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BlockRow = {
  id: string;
  goal_id: string | null;
  parent_block_id: string | null;
  title: string;
  description: string | null;
  status: string | null;
  signal_strength: number | null;
  created_by: string | null;
  created_at: string | null;
};

export type BlockWithDeps = BlockRow & { dependencies: string[] };

export function useBlocks(goalId: string) {
  return useQuery({
    queryKey: ["blocks", goalId],
    queryFn: async () => {
      const [blocksRes, depsRes] = await Promise.all([
        supabase.from("blocks").select("*").eq("goal_id", goalId).order("created_at", { ascending: true }),
        supabase.from("block_dependencies").select("block_id, depends_on_id"),
      ]);
      if (blocksRes.error) throw blocksRes.error;
      if (depsRes.error) throw depsRes.error;

      const blockIds = new Set((blocksRes.data as BlockRow[]).map((b) => b.id));
      const depsMap = new Map<string, string[]>();
      for (const d of depsRes.data) {
        if (blockIds.has(d.block_id) && blockIds.has(d.depends_on_id)) {
          const arr = depsMap.get(d.block_id) || [];
          arr.push(d.depends_on_id);
          depsMap.set(d.block_id, arr);
        }
      }

      return (blocksRes.data as BlockRow[]).map((b) => ({
        ...b,
        dependencies: depsMap.get(b.id) || [],
      })) as BlockWithDeps[];
    },
    enabled: !!goalId,
  });
}

export function useCreateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (block: { goal_id: string; title: string; description?: string; status?: string; dependsOnId?: string; parent_block_id?: string }) => {
      const { data, error } = await supabase
        .from("blocks")
        .insert({ goal_id: block.goal_id, title: block.title, description: block.description || null, status: block.status || "pending", parent_block_id: block.parent_block_id || null })
        .select()
        .single();
      if (error) throw error;

      if (block.dependsOnId) {
        const { error: depErr } = await supabase
          .from("block_dependencies")
          .insert({ block_id: data.id, depends_on_id: block.dependsOnId });
        if (depErr) throw depErr;
      }
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

export function useSetDependencies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ blockId, goalId, dependsOnIds }: { blockId: string; goalId: string; dependsOnIds: string[] }) => {
      // Remove existing deps for this block
      const { error: delErr } = await supabase.from("block_dependencies").delete().eq("block_id", blockId);
      if (delErr) throw delErr;
      // Insert new ones
      if (dependsOnIds.length > 0) {
        const { error: insErr } = await supabase
          .from("block_dependencies")
          .insert(dependsOnIds.map((d) => ({ block_id: blockId, depends_on_id: d })));
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["blocks", vars.goalId] }),
  });
}

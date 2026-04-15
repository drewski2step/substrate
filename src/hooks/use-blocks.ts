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
  heat: number;
  heat_updated_at: string | null;
  created_by: string | null;
  created_at: string | null;
  deleted_at?: string | null;
  is_files_block?: boolean;
  position_x?: number | null;
  position_y?: number | null;
  deadline_at?: string | null;
  recurrence_interval?: string | null;
};

export type BlockWithDeps = BlockRow & { dependencies: string[] };

export function useBlocks(goalId: string) {
  return useQuery({
    queryKey: ["blocks", goalId],
    queryFn: async () => {
      const [blocksRes, depsRes] = await Promise.all([
        supabase.from("blocks").select("*").eq("goal_id", goalId).is("deleted_at", null).order("created_at", { ascending: true }),
        supabase.from("block_dependencies").select("block_id, depends_on_id"),
        supabase.from("block_dependencies").select("block_id, depends_on_id"),
      ]);
      if (blocksRes.error) throw blocksRes.error;
      if (depsRes.error) throw depsRes.error;

      const blockIds = new Set((blocksRes.data as any[]).map((b) => b.id));
      const depsMap = new Map<string, string[]>();
      for (const d of depsRes.data) {
        if (blockIds.has(d.block_id) && blockIds.has(d.depends_on_id)) {
          const arr = depsMap.get(d.block_id) || [];
          arr.push(d.depends_on_id);
          depsMap.set(d.block_id, arr);
        }
      }

      return (blocksRes.data as any[]).map((b) => ({
        ...b,
        heat: b.heat ?? 0,
        heat_updated_at: b.heat_updated_at ?? null,
        dependencies: depsMap.get(b.id) || [],
      })) as BlockWithDeps[];
    },
    enabled: !!goalId,
  });
}

export function useCreateBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (block: { goal_id: string; title: string; description?: string; status?: string; dependsOnId?: string; parent_block_id?: string; created_by?: string; deadline_at?: string }) => {
      const { data, error } = await supabase
        .from("blocks")
        .insert({ goal_id: block.goal_id, title: block.title, description: block.description || null, status: block.status || "pending", parent_block_id: block.parent_block_id || null, created_by: block.created_by || null, deadline_at: block.deadline_at || null } as any)
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
    mutationFn: async ({ id, goalId, updates }: { id: string; goalId: string; updates: Partial<Pick<BlockRow, "title" | "description" | "status" | "signal_strength" | "heat" | "deadline_at" | "recurrence_interval">> & Record<string, any> }) => {
      const { error } = await supabase.from("blocks").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["blocks", vars.goalId] }),
  });
}

export function useDeleteBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, goalId, userId }: { id: string; goalId: string; userId?: string }) => {
      // Rate-limit: new users (< 24h old) can't delete more than 5 blocks in 10 minutes
      if (userId) {
        const { data: profile } = await supabase.from("profiles").select("created_at").eq("id", userId).single();
        if (profile) {
          const accountAge = Date.now() - new Date(profile.created_at).getTime();
          const isNewUser = accountAge < 24 * 60 * 60 * 1000;
          if (isNewUser) {
            const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            const { count } = await supabase
              .from("edit_history")
              .select("id", { count: "exact", head: true })
              .eq("entity_type", "block")
              .eq("field_changed", "deleted_at")
              .eq("changed_by", userId)
              .gte("changed_at", tenMinAgo);
            if ((count ?? 0) >= 5) {
              throw new Error("You've deleted too many blocks too quickly. Please slow down.");
            }
          }
        }
      }
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
      const { error: delErr } = await supabase.from("block_dependencies").delete().eq("block_id", blockId);
      if (delErr) throw delErr;
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

export function useUpdateBlockPosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, goalId, position_x, position_y }: { id: string; goalId: string; position_x: number; position_y: number }) => {
      const { error } = await supabase.from("blocks").update({ position_x, position_y } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["blocks", vars.goalId] }),
  });
}

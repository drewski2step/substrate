import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TraceRow = {
  id: string;
  block_id: string;
  parent_trace_id: string | null;
  agent_name: string;
  action: string;
  content: string;
  created_at: string;
};

export function useTraces(blockId: string) {
  return useQuery({
    queryKey: ["traces", blockId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("traces")
        .select("*")
        .eq("block_id", blockId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TraceRow[];
    },
    enabled: !!blockId,
  });
}

export function useCreateTrace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trace: { block_id: string; parent_trace_id?: string; agent_name: string; action: string; content: string }) => {
      const { data, error } = await supabase
        .from("traces")
        .insert({
          block_id: trace.block_id,
          parent_trace_id: trace.parent_trace_id || null,
          agent_name: trace.agent_name,
          action: trace.action,
          content: trace.content,
        })
        .select()
        .single();
      if (error) throw error;
      return data as TraceRow;
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ["traces", data.block_id] }),
  });
}

export function useDeleteTrace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, blockId }: { id: string; blockId: string }) => {
      const { error } = await supabase.from("traces").delete().eq("id", id);
      if (error) throw error;
      return blockId;
    },
    onSuccess: (blockId) => qc.invalidateQueries({ queryKey: ["traces", blockId] }),
  });
}

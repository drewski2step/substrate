import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EditHistoryRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  changed_by: string | null;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
};

export function useEditHistory(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["edit-history", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edit_history")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data as EditHistoryRow[];
    },
    enabled: !!entityId,
  });
}

export function useLogEdit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      entity_type: string;
      entity_id: string;
      changed_by: string;
      field_changed: string;
      old_value: string | null;
      new_value: string | null;
    }) => {
      const { error } = await supabase.from("edit_history").insert(entry);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["edit-history", vars.entity_type, vars.entity_id] });
    },
  });
}

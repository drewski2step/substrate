import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  deleted_at?: string | null;
  visibility: string;
};

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as GoalRow[];
    },
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: ["goals", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as GoalRow;
    },
    enabled: !!id,
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goal: { title: string; description?: string; status?: string; visibility?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("goals")
        .insert({
          title: goal.title,
          description: goal.description || null,
          status: goal.status || "active",
          visibility: goal.visibility || "public",
          created_by: session?.user?.id || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<GoalRow, "title" | "description" | "status" | "deleted_at">> }) => {
      const { error } = await supabase.from("goals").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

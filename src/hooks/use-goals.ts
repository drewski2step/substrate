import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
};

export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
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
    mutationFn: async (goal: { title: string; description?: string; status?: string }) => {
      const { data, error } = await supabase
        .from("goals")
        .insert({ title: goal.title, description: goal.description || null, status: goal.status || "active" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

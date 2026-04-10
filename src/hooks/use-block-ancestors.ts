import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AncestorBlock = { id: string; title: string; parent_block_id: string | null };

export function useBlockAncestors(blockId: string) {
  return useQuery({
    queryKey: ["block_ancestors", blockId],
    queryFn: async () => {
      // Walk up the parent chain
      const ancestors: AncestorBlock[] = [];
      let currentId: string | null = blockId;
      const seen = new Set<string>();
      while (currentId && !seen.has(currentId)) {
        seen.add(currentId);
        const { data, error } = await supabase
          .from("blocks")
          .select("id, title, parent_block_id")
          .eq("id", currentId)
          .single();
        if (error || !data) break;
        ancestors.unshift({ id: data.id, title: data.title, parent_block_id: data.parent_block_id as string | null });
        currentId = data.parent_block_id as string | null;
      }
      return ancestors;
    },
    enabled: !!blockId,
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BlockChatRow = {
  id: string;
  block_id: string;
  sender_name: string;
  message: string;
  created_at: string;
};

export function useBlockChats(blockId: string) {
  return useQuery({
    queryKey: ["block_chats", blockId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("block_chats")
        .select("*")
        .eq("block_id", blockId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as BlockChatRow[];
    },
    enabled: !!blockId,
  });
}

export function useCreateBlockChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (chat: { block_id: string; sender_name: string; message: string }) => {
      const { data, error } = await supabase
        .from("block_chats")
        .insert({ block_id: chat.block_id, sender_name: chat.sender_name, message: chat.message })
        .select()
        .single();
      if (error) throw error;
      return data as BlockChatRow;
    },
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ["block_chats", data.block_id] }),
  });
}

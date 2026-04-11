import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DocumentRow = {
  id: string;
  block_id: string;
  goal_id: string;
  uploaded_by: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
};

export function useBlockDocuments(blockId: string) {
  return useQuery({
    queryKey: ["block-documents", blockId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("block_documents")
        .select("*")
        .eq("block_id", blockId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentRow[];
    },
    enabled: !!blockId,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      blockId,
      goalId,
      file,
      userId,
      parentBlockId,
    }: {
      blockId: string;
      goalId: string;
      file: File;
      userId: string;
      parentBlockId?: string;
    }) => {
      console.log("[upload] Starting upload", { blockId, goalId, fileName: file.name, userId, parentBlockId });

      // Upload to storage
      const filePath = `${userId}/${blockId}/${Date.now()}_${file.name}`;
      console.log("[upload] Storage path:", filePath);
      const { error: uploadError } = await supabase.storage
        .from("block-documents")
        .upload(filePath, file);
      if (uploadError) {
        console.error("[upload] Storage upload failed:", uploadError);
        throw uploadError;
      }
      console.log("[upload] Storage upload succeeded");

      const { data: urlData } = supabase.storage
        .from("block-documents")
        .getPublicUrl(filePath);
      console.log("[upload] Public URL:", urlData.publicUrl);

      const ext = file.name.split(".").pop()?.toLowerCase() || "";

      // Insert record using the files block's real ID
      console.log("[upload] Inserting block_documents row with block_id:", blockId);
      const { data, error } = await supabase
        .from("block_documents")
        .insert({
          block_id: blockId,
          goal_id: goalId,
          uploaded_by: userId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: ext,
          file_size: file.size,
        })
        .select()
        .single();
      if (error) {
        console.error("[upload] block_documents insert failed:", error);
        throw error;
      }
      console.log("[upload] block_documents insert succeeded:", data);

      // +6 heat, +4 signal on the PARENT block (not the files block)
      const heatTargetId = parentBlockId || blockId;
      const { data: blk } = await supabase
        .from("blocks")
        .select("heat, signal_strength")
        .eq("id", heatTargetId)
        .single();
      if (blk) {
        await supabase
          .from("blocks")
          .update({
            heat: (blk.heat || 0) + 6,
            signal_strength: (blk.signal_strength || 0) + 4,
            heat_updated_at: new Date().toISOString(),
          } as any)
          .eq("id", heatTargetId);
      }

      return data as DocumentRow;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["block-documents", data.block_id] });
      qc.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, blockId, fileUrl }: { id: string; blockId: string; fileUrl: string }) => {
      // Extract path from URL for storage deletion
      const urlParts = fileUrl.split("/block-documents/");
      if (urlParts.length > 1) {
        const storagePath = decodeURIComponent(urlParts[1]);
        await supabase.storage.from("block-documents").remove([storagePath]);
      }

      const { error } = await supabase
        .from("block_documents")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["block-documents", vars.blockId] });
    },
  });
}

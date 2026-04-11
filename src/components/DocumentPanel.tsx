import { useState, useRef } from "react";
import { useBlockDocuments, useUploadDocument, useDeleteDocument, DocumentRow } from "@/hooks/use-documents";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, Trash2, FileText, File } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.txt";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function useUsername(userId: string | null) {
  return useQuery({
    queryKey: ["profile-username", userId],
    queryFn: async () => {
      if (!userId) return "Unknown";
      const { data } = await supabase.from("profiles").select("username").eq("id", userId).single();
      return data?.username || "Unknown";
    },
    enabled: !!userId,
  });
}

function DocumentRow({ doc, currentUserId }: { doc: DocumentRow; currentUserId: string | null }) {
  const deleteDoc = useDeleteDocument();
  const { data: username } = useUsername(doc.uploaded_by);

  return (
    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group">
      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{doc.file_name}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <Badge variant="outline" className="text-[9px] px-1 py-0">{doc.file_type?.toUpperCase() || "FILE"}</Badge>
          <span>{formatFileSize(doc.file_size)}</span>
          <span>by {username}</span>
          <span>{format(new Date(doc.created_at), "MMM d")}</span>
        </div>
      </div>
      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Download className="w-3.5 h-3.5" />
        </Button>
      </a>
      {currentUserId === doc.uploaded_by && (
        <Button
          variant="ghost" size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100"
          onClick={() => deleteDoc.mutate(
            { id: doc.id, blockId: doc.block_id, fileUrl: doc.file_url },
            { onError: (err: any) => toast.error(err.message) }
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

export function DocumentPanel({ blockId, goalId, blockTitle }: { blockId: string; goalId: string; blockTitle: string }) {
  const { data: docs, isLoading } = useBlockDocuments(blockId);
  const uploadDoc = useUploadDocument();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || !user) {
      if (!user) toast.error("Sign in to upload files");
      return;
    }
    Array.from(files).forEach((file) => {
      uploadDoc.mutate(
        { blockId, goalId, file, userId: user.id },
        { onError: (err: any) => toast.error(err.message) }
      );
    });
  };

  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-1.5">
          <File className="w-3.5 h-3.5" /> {blockTitle} Files
        </h3>
      </div>

      {/* Upload area */}
      <div
        className="mx-3 mt-3 p-4 border-2 border-dashed border-border rounded-lg text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
        <p className="text-xs text-muted-foreground">
          {uploadDoc.isPending ? "Uploading..." : "Drop files here or click to upload"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">PDF, DOC, DOCX, TXT</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      <ScrollArea className="flex-1 mt-2">
        <div className="px-3 pb-3 space-y-1">
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-4">Loading files...</p>
          ) : !docs || docs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No files attached yet.</p>
          ) : (
            docs.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} currentUserId={user?.id || null} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

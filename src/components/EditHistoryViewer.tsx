import { useEditHistory } from "@/hooks/use-edit-history";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History } from "lucide-react";

function useUsername(userId: string | null) {
  return useQuery({
    queryKey: ["profile-username", userId],
    queryFn: async () => {
      if (!userId) return "Unknown";
      const { data } = await supabase.from("profiles").select("username").eq("id", userId).single();
      return data?.username || "Unknown";
    },
    enabled: !!userId,
    staleTime: 60000,
  });
}

function HistoryEntry({ entry }: { entry: { changed_by: string | null; field_changed: string; old_value: string | null; new_value: string | null; changed_at: string } }) {
  const { data: username } = useUsername(entry.changed_by);
  return (
    <div className="flex items-start gap-2 text-xs py-1.5 border-b border-border last:border-0">
      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p>
          <span className="font-medium">{username}</span>
          {" changed "}
          <span className="font-mono text-primary">{entry.field_changed}</span>
        </p>
        {entry.old_value && (
          <p className="text-muted-foreground truncate">
            <span className="line-through">{entry.old_value}</span> → {entry.new_value}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground">{format(new Date(entry.changed_at), "MMM d, h:mm a")}</p>
      </div>
    </div>
  );
}

export function EditHistoryViewer({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data: history, isLoading } = useEditHistory(entityType, entityId);

  if (isLoading) return <p className="text-xs text-muted-foreground py-2">Loading...</p>;
  if (!history || history.length === 0) return <p className="text-xs text-muted-foreground py-2">No edit history.</p>;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center gap-1.5">
        <History className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Edit History</span>
      </div>
      <ScrollArea className="max-h-48">
        <div className="px-3 py-1">
          {history.map((entry) => (
            <HistoryEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

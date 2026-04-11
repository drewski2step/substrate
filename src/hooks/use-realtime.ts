import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRealtimeSync(goalId: string) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!goalId) return;

    const channel = supabase
      .channel(`goal-${goalId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "blocks" }, () => {
        qc.invalidateQueries({ queryKey: ["blocks", goalId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "discussions" }, () => {
        qc.invalidateQueries({ queryKey: ["discussions"] });
        qc.invalidateQueries({ queryKey: ["discussion-counts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "block_pledges" }, () => {
        qc.invalidateQueries({ queryKey: ["pledges"] });
      })
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [goalId, qc]);

  return { connected };
}

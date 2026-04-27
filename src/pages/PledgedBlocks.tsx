import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCheck } from "lucide-react";
import { toast } from "sonner";

export default function PledgedBlocks() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("username", username!).maybeSingle();
      return data;
    },
    enabled: !!username,
  });

  const isOwn = !!user && !!profile && user.id === profile.id;

  const { data: blocks, isLoading } = useQuery({
    queryKey: ["pledged-blocks-page", profile?.id],
    queryFn: async () => {
      const { data: pledges } = await supabase
        .from("block_pledges")
        .select("id, block_id")
        .eq("user_id", profile!.id)
        .eq("active", true);
      if (!pledges?.length) return [];
      const blockIds = pledges.map((p) => p.block_id);
      const { data: blockData } = await supabase
        .from("blocks")
        .select("id, title, goal_id, heat, status")
        .in("id", blockIds)
        .is("deleted_at", null)
        .is("completed_at", null);
      if (!blockData?.length) return [];
      const goalIds = Array.from(new Set(blockData.map((b) => b.goal_id).filter(Boolean) as string[]));
      const { data: goals } = await supabase.from("goals").select("id, title").in("id", goalIds);
      const goalMap = new Map((goals ?? []).map((g) => [g.id, g.title]));
      const { data: allPledges } = await supabase
        .from("block_pledges").select("block_id").in("block_id", blockIds).eq("active", true);
      const pledgeCount: Record<string, number> = {};
      (allPledges ?? []).forEach((p) => { pledgeCount[p.block_id] = (pledgeCount[p.block_id] ?? 0) + 1; });
      return blockData.map((b) => ({
        ...b,
        missionTitle: goalMap.get(b.goal_id ?? "") ?? "Unknown Mission",
        pledgeCount: pledgeCount[b.id] ?? 1,
        pledgeId: pledges.find((p) => p.block_id === b.id)?.id,
      }));
    },
    enabled: !!profile?.id,
  });

  // Utah-inspired brick colors (same palette as BlockFlowChart)
  function pickUtahColor() {
    const colors = ["#c0392b","#e67e22","#d4a017","#7f8c8d","#8e44ad","#2980b9","#27ae60","#e74c3c","#f39c12","#16a085"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  const completeBlock = useMutation({
    mutationFn: async ({ blockId }: { blockId: string }) => {
      const { error } = await supabase
        .from("blocks")
        .update({
          status: "complete",
          completed_by: user!.id,
          completed_at: new Date().toISOString(),
          brick_color: pickUtahColor(),
        } as any)
        .eq("id", blockId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pledged-blocks-page", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-pledge-count", profile?.id] });
      toast.success("Block completed");
    },
    onError: () => toast.error("Failed to complete block"),
  });

  const unpledge = useMutation({
    mutationFn: async (pledgeId: string) => {
      const { error } = await supabase
        .from("block_pledges")
        .update({ active: false, unpledged_at: new Date().toISOString() })
        .eq("id", pledgeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pledged-blocks-page", profile?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-pledge-count", profile?.id] });
      toast.success("Unpledged");
    },
    onError: () => toast.error("Failed to unpledge"),
  });

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 animate-fade-in-up">
        <Link
          to={`/profile/${username}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {username}
        </Link>

        <h1 className="text-xl font-bold font-mono mb-1">Pledged Blocks</h1>
        <p className="text-sm text-muted-foreground font-mono mb-8">
          {isLoading ? "Loading…" : `${blocks?.length ?? 0} active pledges`}
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : blocks && blocks.length > 0 ? (
          <div className="space-y-2">
            {blocks.map((b) => (
              <div
                key={b.id}
                className="relative overflow-hidden rounded-lg border border-slate-700 p-4"
                style={{ background: "#0a0f1e" }}
              >
                {/* star dots */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
                  {Array.from({ length: 18 }, (_, i) => (
                    <circle
                      key={i}
                      cx={`${(i * 137.5) % 100}%`}
                      cy={`${(i * 79.3) % 100}%`}
                      r={i % 3 === 0 ? 1.5 : 1}
                      fill="white"
                      opacity={0.3 + (i % 5) * 0.1}
                    />
                  ))}
                </svg>
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <Link to={`/mission/${b.goal_id}/block/${b.id}`} className="flex-1 min-w-0 group">
                    <p className="text-sm font-semibold font-mono text-white truncate group-hover:text-orange-300 transition-colors">
                      {b.title}
                    </p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5 truncate">{b.missionTitle}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs font-mono text-slate-500">
                        heat <span className="text-slate-300">{b.heat}</span>
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        <span className="text-slate-300">{b.pledgeCount}</span> pledging
                      </span>
                    </div>
                  </Link>
                  {isOwn && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 h-7 px-2 gap-1"
                        disabled={completeBlock.isPending || unpledge.isPending}
                        onClick={() => completeBlock.mutate({ blockId: b.id })}
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Complete
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-slate-400 hover:text-red-400 hover:bg-red-400/10 h-7 px-2"
                        disabled={unpledge.isPending || completeBlock.isPending}
                        onClick={() => b.pledgeId && unpledge.mutate(b.pledgeId)}
                      >
                        Unpledge
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground font-mono">No active pledges.</p>
        )}
      </main>
    </>
  );
}

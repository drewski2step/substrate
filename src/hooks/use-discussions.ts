import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DiscussionRow = {
  id: string;
  block_id: string | null;
  goal_id: string | null;
  parent_id: string | null;
  user_id: string | null;
  type: string;
  title: string | null;
  content: string;
  upvotes: number;
  scope: string;
  resolved: boolean;
  created_at: string;
};

export function useBlockDiscussions(blockId: string) {
  return useQuery({
    queryKey: ["discussions", "block", blockId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussions")
        .select("*")
        .eq("block_id", blockId)
        .is("parent_id", null)
        .order("upvotes", { ascending: false });
      if (error) throw error;
      return data as DiscussionRow[];
    },
    enabled: !!blockId,
  });
}

export function useMissionDiscussions(goalId: string) {
  return useQuery({
    queryKey: ["discussions", "mission", goalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussions")
        .select("*")
        .eq("goal_id", goalId)
        .eq("scope", "mission")
        .is("parent_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DiscussionRow[];
    },
    enabled: !!goalId,
  });
}

export function useDiscussionReplies(parentId: string) {
  return useQuery({
    queryKey: ["discussions", "replies", parentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussions")
        .select("*")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as DiscussionRow[];
    },
    enabled: !!parentId,
  });
}

export function useCreateDiscussion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (post: {
      block_id?: string | null;
      goal_id: string;
      parent_id?: string | null;
      type: string;
      title?: string | null;
      content: string;
      scope?: string;
    }) => {
      const { data, error } = await supabase
        .from("discussions")
        .insert({
          block_id: post.block_id || null,
          goal_id: post.goal_id,
          parent_id: post.parent_id || null,
          type: post.type,
          title: post.title || null,
          content: post.content,
          scope: post.scope || "block",
        })
        .select()
        .single();
      if (error) throw error;

      // Deposit heat + signal on tagged block
      const targetBlockId = post.block_id;
      if (targetBlockId) {
        const heatAmount = post.parent_id ? 4 : 10;
        const signalAmount = post.parent_id ? 3 : 5;
        await Promise.all([
          supabase.rpc("increment_block_heat" as any, { block_id_input: targetBlockId, amount: heatAmount }),
          supabase.from("signals").insert({ block_id: targetBlockId, value: signalAmount }),
          supabase.from("blocks").update({ signal_strength: (undefined as any) }).eq("id", "noop"), // we'll handle signal_strength via raw increment
        ]).catch(() => {});
        // Increment signal_strength directly
        const { data: blk } = await supabase.from("blocks").select("signal_strength").eq("id", targetBlockId).single();
        if (blk) {
          await supabase.from("blocks").update({ signal_strength: (blk.signal_strength || 0) + signalAmount }).eq("id", targetBlockId);
        }
      }

      // If scope is mission, add extra heat
      if (post.scope === "mission" && targetBlockId) {
        await supabase.rpc("increment_block_heat" as any, { block_id_input: targetBlockId, amount: 8 }).catch(() => {});
      }

      return data as DiscussionRow;
    },
    onSuccess: (data) => {
      if (data.block_id) qc.invalidateQueries({ queryKey: ["discussions", "block", data.block_id] });
      if (data.goal_id) qc.invalidateQueries({ queryKey: ["discussions", "mission", data.goal_id] });
      if (data.parent_id) qc.invalidateQueries({ queryKey: ["discussions", "replies", data.parent_id] });
      qc.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}

export function useUpvoteDiscussion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, blockId }: { id: string; blockId?: string | null }) => {
      // Get current upvotes
      const { data: post } = await supabase.from("discussions").select("upvotes").eq("id", id).single();
      if (!post) throw new Error("Post not found");
      const { error } = await supabase.from("discussions").update({ upvotes: post.upvotes + 1 }).eq("id", id);
      if (error) throw error;

      if (blockId) {
        await supabase.rpc("increment_block_heat" as any, { block_id_input: blockId, amount: 2 }).catch(() => {});
        const { data: blk } = await supabase.from("blocks").select("signal_strength").eq("id", blockId).single();
        if (blk) {
          await supabase.from("blocks").update({ signal_strength: (blk.signal_strength || 0) + 1 }).eq("id", blockId);
        }
        await supabase.from("signals").insert({ block_id: blockId, value: 1 }).catch(() => {});
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussions"] });
      qc.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}

export function useResolveDiscussion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, blockId }: { id: string; blockId?: string | null }) => {
      const { error } = await supabase.from("discussions").update({ resolved: true }).eq("id", id);
      if (error) throw error;

      if (blockId) {
        await supabase.rpc("increment_block_heat" as any, { block_id_input: blockId, amount: 15 }).catch(() => {});
        const { data: blk } = await supabase.from("blocks").select("signal_strength").eq("id", blockId).single();
        if (blk) {
          await supabase.from("blocks").update({ signal_strength: (blk.signal_strength || 0) + 8 }).eq("id", blockId);
        }
        await supabase.from("signals").insert({ block_id: blockId, value: 8 }).catch(() => {});
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussions"] });
      qc.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}

// Count unresolved questions and blockers for a block
export function useBlockDiscussionCounts(blockId: string) {
  return useQuery({
    queryKey: ["discussion-counts", blockId],
    queryFn: async () => {
      const [questionsRes, blockersRes] = await Promise.all([
        supabase.from("discussions").select("id", { count: "exact", head: true }).eq("block_id", blockId).eq("type", "question").eq("resolved", false).is("parent_id", null),
        supabase.from("discussions").select("id", { count: "exact", head: true }).eq("block_id", blockId).eq("type", "blocker").eq("resolved", false).is("parent_id", null),
      ]);
      return {
        openQuestions: questionsRes.count || 0,
        openBlockers: blockersRes.count || 0,
      };
    },
    enabled: !!blockId,
  });
}

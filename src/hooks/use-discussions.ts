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
  edited_at: string | null;
  deleted_at: string | null;
};

export function useBlockDiscussions(blockId: string) {
  return useQuery({
    queryKey: ["discussions", "block", blockId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussions" as any)
        .select("*")
        .eq("block_id", blockId)
        .is("parent_id", null)
        .order("upvotes", { ascending: false });
      if (error) throw error;
      return data as unknown as DiscussionRow[];
    },
    enabled: !!blockId,
  });
}

export function useMissionDiscussions(goalId: string) {
  return useQuery({
    queryKey: ["discussions", "mission", goalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussions" as any)
        .select("*")
        .eq("goal_id", goalId)
        .eq("scope", "mission")
        .is("parent_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DiscussionRow[];
    },
    enabled: !!goalId,
  });
}

export function useDiscussionReplies(parentId: string) {
  return useQuery({
    queryKey: ["discussions", "replies", parentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussions" as any)
        .select("*")
        .eq("parent_id", parentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as DiscussionRow[];
    },
    enabled: !!parentId,
  });
}

async function incrementHeat(blockId: string, amount: number) {
  const { data: blk } = await supabase.from("blocks").select("heat, signal_strength").eq("id", blockId).single();
  if (blk) {
    await supabase.from("blocks").update({
      heat: ((blk as any).heat || 0) + amount,
      heat_updated_at: new Date().toISOString(),
    } as any).eq("id", blockId);
  }
}

async function incrementSignal(blockId: string, amount: number) {
  const { data: blk } = await supabase.from("blocks").select("signal_strength").eq("id", blockId).single();
  if (blk) {
    await supabase.from("blocks").update({
      signal_strength: (blk.signal_strength || 0) + amount,
    } as any).eq("id", blockId);
  }
  await supabase.from("signals").insert({ block_id: blockId, value: amount });
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
        .from("discussions" as any)
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

      const targetBlockId = post.block_id;
      if (targetBlockId) {
        const heatAmount = post.parent_id ? 4 : 10;
        const signalAmount = post.parent_id ? 3 : 5;
        await incrementHeat(targetBlockId, heatAmount);
        await incrementSignal(targetBlockId, signalAmount);
        if (post.scope === "mission") {
          await incrementHeat(targetBlockId, 8);
        }
      }

      return data as unknown as DiscussionRow;
    },
    onSuccess: (data) => {
      if (data.block_id) qc.invalidateQueries({ queryKey: ["discussions", "block", data.block_id] });
      if (data.goal_id) qc.invalidateQueries({ queryKey: ["discussions", "mission", data.goal_id] });
      if (data.parent_id) qc.invalidateQueries({ queryKey: ["discussions", "replies", data.parent_id] });
      qc.invalidateQueries({ queryKey: ["blocks"] });
      qc.invalidateQueries({ queryKey: ["discussion-counts"] });
    },
  });
}

export function useUpvoteDiscussion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, blockId }: { id: string; blockId?: string | null }) => {
      const { data: post } = await supabase.from("discussions" as any).select("upvotes").eq("id", id).single();
      if (!post) throw new Error("Post not found");
      const { error } = await supabase.from("discussions" as any).update({ upvotes: (post as any).upvotes + 1 }).eq("id", id);
      if (error) throw error;

      if (blockId) {
        await incrementHeat(blockId, 2);
        await incrementSignal(blockId, 1);
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
      const { error } = await supabase.from("discussions" as any).update({ resolved: true }).eq("id", id);
      if (error) throw error;

      if (blockId) {
        await incrementHeat(blockId, 15);
        await incrementSignal(blockId, 8);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussions"] });
      qc.invalidateQueries({ queryKey: ["blocks"] });
    },
  });
}

export function useBlockDiscussionCounts(blockId: string) {
  return useQuery({
    queryKey: ["discussion-counts", blockId],
    queryFn: async () => {
      const [questionsRes, blockersRes] = await Promise.all([
        supabase.from("discussions" as any).select("id", { count: "exact", head: true }).eq("block_id", blockId).eq("type", "question").eq("resolved", false).is("parent_id", null),
        supabase.from("discussions" as any).select("id", { count: "exact", head: true }).eq("block_id", blockId).eq("type", "blocker").eq("resolved", false).is("parent_id", null),
      ]);
      return {
        openQuestions: questionsRes.count || 0,
        openBlockers: blockersRes.count || 0,
      };
    },
    enabled: !!blockId,
  });
}

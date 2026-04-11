import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Decay all blocks' heat by 2%
    const { data: blocks, error: fetchErr } = await supabase
      .from("blocks")
      .select("id, heat")
      .gt("heat", 0);

    if (fetchErr) throw fetchErr;

    let updated = 0;
    for (const block of blocks || []) {
      const newHeat = Math.floor(block.heat * 0.98);
      const finalHeat = newHeat < 1 ? 0 : newHeat;
      if (finalHeat !== block.heat) {
        await supabase.from("blocks").update({ heat: finalHeat, heat_updated_at: new Date().toISOString() }).eq("id", block.id);
        updated++;
      }
    }

    return new Response(JSON.stringify({ decayed: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

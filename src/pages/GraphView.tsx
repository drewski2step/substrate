import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ForceGraph3D from "3d-force-graph";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";

interface Block {
  id: string;
  title: string;
  status: string | null;
  goal_id: string | null;
  signal_strength: number | null;
  heat: number;
  parent_block_id: string | null;
}

interface Goal {
  id: string;
  title: string;
}

interface Dependency {
  block_id: string;
  depends_on_id: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "#f97316",    // orange
  complete: "#22c55e",  // green
  blocked: "#ef4444",   // red
  proposed: "#a78bfa",  // purple
  default: "#94a3b8",   // slate
};

// Generate a stable color per goal_id
const GOAL_PALETTE = [
  "#f97316", "#3b82f6", "#a78bfa", "#22c55e",
  "#ec4899", "#14b8a6", "#eab308", "#f43f5e",
];

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [blockCount, setBlockCount] = useState(0);
  const [linkCount, setLinkCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [{ data: blocks }, { data: goals }, { data: deps }] = await Promise.all([
        supabase.from("blocks").select("id,title,status,goal_id,signal_strength,heat,parent_block_id").is("deleted_at", null),
        supabase.from("goals").select("id,title"),
        supabase.from("block_dependencies").select("block_id,depends_on_id"),
      ]);

      if (!blocks || !containerRef.current) return;

      // Map goal_id -> color
      const goalColorMap: Record<string, string> = {};
      (goals || []).forEach((g: Goal, i: number) => {
        goalColorMap[g.id] = GOAL_PALETTE[i % GOAL_PALETTE.length];
      });

      const blockIds = new Set(blocks.map((b: Block) => b.id));

      const nodes = blocks.map((b: Block) => ({
        id: b.id,
        name: b.title,
        status: b.status,
        goal_id: b.goal_id,
        val: Math.max(1, (b.signal_strength || 0) * 0.5 + (b.heat || 0) * 0.3 + 1),
        color: b.goal_id ? goalColorMap[b.goal_id] : STATUS_COLORS[b.status || "default"] || STATUS_COLORS.default,
      }));

      // Combine block_dependencies + parent_block_id edges
      const links: { source: string; target: string }[] = [];
      const seen = new Set<string>();

      (deps || []).forEach((d: Dependency) => {
        if (blockIds.has(d.block_id) && blockIds.has(d.depends_on_id)) {
          const key = `${d.block_id}-${d.depends_on_id}`;
          if (!seen.has(key)) { seen.add(key); links.push({ source: d.block_id, target: d.depends_on_id }); }
        }
      });

      blocks.forEach((b: Block) => {
        if (b.parent_block_id && blockIds.has(b.parent_block_id)) {
          const key = `${b.id}-${b.parent_block_id}`;
          if (!seen.has(key)) { seen.add(key); links.push({ source: b.id, target: b.parent_block_id }); }
        }
      });

      setBlockCount(nodes.length);
      setLinkCount(links.length);
      setLoading(false);

      const Graph = (ForceGraph3D as any)()(containerRef.current)
        .graphData({ nodes, links })
        .backgroundColor("#09090b")
        .nodeLabel("name")
        .nodeColor((n: any) => n.color)
        .nodeVal((n: any) => n.val)
        .nodeOpacity(0.92)
        .linkColor(() => "rgba(148,163,184,0.25)")
        .linkWidth(0.8)
        .linkDirectionalParticles(1)
        .linkDirectionalParticleWidth(1.2)
        .linkDirectionalParticleColor(() => "rgba(249,115,22,0.6)")
        .onNodeClick((node: any) => {
          // Find mission for this block and navigate
          if (node.goal_id) {
            navigate(`/mission/${node.goal_id}`);
          }
        })
        .onNodeHover((node: any) => {
          if (containerRef.current) {
            containerRef.current.style.cursor = node ? "pointer" : "default";
          }
        });

      // Slow rotation
      let angle = 0;
      const timer = setInterval(() => {
        Graph.cameraPosition({
          x: 300 * Math.sin(angle),
          z: 300 * Math.cos(angle),
        });
        angle += 0.002;
      }, 33);

      graphRef.current = Graph;

      return () => {
        clearInterval(timer);
        Graph._destructor?.();
      };
    }

    load();

    return () => {
      graphRef.current?._destructor?.();
    };
  }, [navigate]);

  return (
    <div className="flex flex-col h-screen bg-[#09090b] overflow-hidden">
      <AppHeader />

      {/* HUD overlay */}
      <div className="absolute top-20 left-6 z-10 flex flex-col gap-1 pointer-events-none">
        <p className="text-xs font-mono text-orange-400/80 uppercase tracking-widest">Substrate Graph</p>
        {!loading && (
          <>
            <p className="text-xs font-mono text-slate-500">{blockCount} blocks</p>
            <p className="text-xs font-mono text-slate-500">{linkCount} connections</p>
          </>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <p className="text-xs font-mono text-slate-500 animate-pulse">Loading graph...</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-10 pointer-events-none flex flex-col gap-1.5">
        <p className="text-xs font-mono text-slate-600 uppercase tracking-widest mb-1">Color = Mission</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-xs font-mono text-slate-500">Node size = signal strength</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-px bg-slate-500/40" />
          <span className="text-xs font-mono text-slate-500">Dependency / parent link</span>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 w-full" />
    </div>
  );
}

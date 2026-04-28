import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBlocks, BlockWithDeps } from "@/hooks/use-blocks";
import { useGoal } from "@/hooks/use-goals";
import { Skeleton } from "@/components/ui/skeleton";

// --- Heat color (ROYGBIV) ---
function getHeatHex(heat: number): string {
  if (heat === 0) return "#D1D5DB";
  if (heat <= 10) return "#EF4444";
  if (heat <= 25) return "#F97316";
  if (heat <= 50) return "#EAB308";
  if (heat <= 80) return "#22C55E";
  if (heat <= 120) return "#14B8A6";
  if (heat <= 170) return "#3B82F6";
  return "#8B5CF6";
}

// --- Tree node ---
interface TreeNode {
  id: string;
  title: string;
  heat: number;
  completedAt: string | null;
  children: TreeNode[];
}

// --- Build tree from flat block list ---
function buildBlockTree(blocks: BlockWithDeps[]): TreeNode[] {
  // Index ALL blocks so we can distinguish "no parent" from "completed parent"
  const allBlockIds = new Set(blocks.map((b) => b.id));
  const active = blocks.filter((b) => !b.completed_at);
  // Debug: log first 3 blocks to verify parent_block_id is present
  console.log("[buildBlockTree] first 3 blocks:", blocks.slice(0, 3).map(b => ({
    id: b.id, title: b.title, parent_block_id: b.parent_block_id, completed_at: b.completed_at, heat: b.heat,
  })));
  const map = new Map<string, TreeNode>();
  active.forEach((b) =>
    map.set(b.id, {
      id: b.id,
      title: b.title,
      heat: b.heat ?? 0,
      completedAt: b.completed_at ?? null,
      children: [],
    })
  );

  const roots: TreeNode[] = [];
  active.forEach((b) => {
    const node = map.get(b.id)!;
    if (b.parent_block_id && map.has(b.parent_block_id)) {
      // Parent is active — attach as child
      map.get(b.parent_block_id)!.children.push(node);
    } else if (!b.parent_block_id || !allBlockIds.has(b.parent_block_id)) {
      // Truly top-level (no parent) or parent was deleted — treat as root
      roots.push(node);
    }
    // Otherwise parent exists but is completed — skip this block
    // (it belongs to a completed subtree)
  });
  return roots;
}

// --- Bar data for rendering ---
interface BarData {
  blockId: string;
  title: string;
  heat: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- Recursive Cantor layout ---
function layoutTree(
  node: TreeNode,
  x: number,
  y: number,
  width: number,
  bars: BarData[]
): void {
  const height = Math.max(1, width / 6);
  bars.push({
    blockId: node.id,
    title: node.title,
    heat: node.heat,
    x,
    y,
    width,
    height,
  });

  const children = node.children.filter((c) => !c.completedAt);
  const N = children.length;
  if (N === 0) return;

  const childWidth = N === 1 ? width : width / (2 * N - 1);
  const childY = y + height + height * 0.75;

  children.forEach((child, i) => {
    const childX = x + i * 2 * childWidth;
    layoutTree(child, childX, childY, childWidth, bars);
  });
}

// --- Compute bounding box ---
function computeBounds(bars: BarData[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const bar of bars) {
    minX = Math.min(minX, bar.x);
    minY = Math.min(minY, bar.y);
    maxX = Math.max(maxX, bar.x + bar.width);
    maxY = Math.max(maxY, bar.y + bar.height);
  }
  return { minX, minY, maxX, maxY };
}

const CANVAS_WIDTH = 120000;
const MISSION_BAR_HEIGHT = 3000;

export function KochFractalMap({ missionId }: { missionId: string }) {
  const navigate = useNavigate();
  const { data: goal } = useGoal(missionId);
  const { data: allBlocks, isLoading } = useBlocks(missionId);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [hasAutoFit, setHasAutoFit] = useState(false);
  const zoomRef = useRef(1);
  zoomRef.current = transform.scale;

  // Filter to displayable blocks (not deleted, not file blocks)
  const blocks = useMemo(
    () =>
      (allBlocks || []).filter(
        (b) =>
          !b.deleted_at &&
          !(b as any).is_files_block
      ),
    [allBlocks]
  );

  // Build tree and compute all bar positions
  const { bars, missionBar } = useMemo(() => {
    if (blocks.length === 0)
      return { bars: [] as BarData[], missionBar: null };

    const roots = buildBlockTree(blocks);
    const mBar: BarData = {
      blockId: "",
      title: goal?.title ?? "Mission",
      heat: -1,
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: MISSION_BAR_HEIGHT,
    };

    const allBars: BarData[] = [];
    const N = roots.length;

    if (N === 0) return { bars: allBars, missionBar: mBar };

    const childWidth =
      N === 1 ? CANVAS_WIDTH : CANVAS_WIDTH / (2 * N - 1);
    const childY =
      MISSION_BAR_HEIGHT + MISSION_BAR_HEIGHT * 0.75;

    roots.forEach((root, i) => {
      const childX = i * 2 * childWidth;
      layoutTree(root, childX, childY, childWidth, allBars);
    });

    return { bars: allBars, missionBar: mBar };
  }, [blocks, goal]);

  // Auto-fit on load
  useEffect(() => {
    if ((!bars.length && !missionBar) || hasAutoFit) return;
    const container = containerRef.current;
    if (!container) return;

    const allItems = missionBar ? [missionBar, ...bars] : bars;
    if (allItems.length === 0) return;

    const { minX, minY, maxX, maxY } = computeBounds(allItems);
    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw === 0 || bh === 0) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const padding = 20;
    const scale = Math.min(
      cw / (bw + padding * 2),
      ch / (bh + padding * 2)
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setTransform({
      x: cw / 2 - cx * scale,
      y: ch / 2 - cy * scale,
      scale,
    });
    setHasAutoFit(true);
  }, [bars, missionBar, hasAutoFit]);

  // Reset auto-fit on mission change
  useEffect(() => {
    setHasAutoFit(false);
  }, [missionId]);

  // Fit button handler
  const handleFit = useCallback(() => {
    setHasAutoFit(false);
  }, []);

  // Wheel zoom (cursor-anchored)
  const MAX_PAN = 1e8;
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = Math.pow(0.999, e.deltaY);
    setTransform((t) => {
      const newScale = Math.max(0.0005, Math.min(200, t.scale * factor));
      const newX = Math.max(-MAX_PAN, Math.min(MAX_PAN, mx - (mx - t.x) * (newScale / t.scale)));
      const newY = Math.max(-MAX_PAN, Math.min(MAX_PAN, my - (my - t.y) * (newScale / t.scale)));
      return { x: newX, y: newY, scale: newScale };
    });
  }, []);

  // Pan via mouse drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as SVGElement;
      if (target.closest("[data-bar]")) return;
      setIsPanning(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.x,
        ty: transform.y,
      };
    },
    [transform]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setTransform((t) => ({
          ...t,
          x: Math.max(-MAX_PAN, Math.min(MAX_PAN, panStart.current.tx + dx)),
          y: Math.max(-MAX_PAN, Math.min(MAX_PAN, panStart.current.ty + dy)),
        }));
      }
      // Update tooltip position on mouse move over bars
      if (tooltip) {
        const rect = svgRef.current?.getBoundingClientRect();
        if (rect) {
          setTooltip((prev) =>
            prev
              ? {
                  ...prev,
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top - 10,
                }
              : null
          );
        }
      }
    },
    [isPanning, tooltip]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] text-muted-foreground text-sm">
        No blocks yet. Add some blocks to see the fractal map.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full border border-dashed border-muted-foreground/20 rounded-lg overflow-hidden bg-background"
      style={{ height: "calc(100vh - 200px)" }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g
          transform={`translate(${isFinite(transform.x) ? transform.x : 0}, ${isFinite(transform.y) ? transform.y : 0}) scale(${isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1})`}
        >
          {/* Mission bar (row 0) — decorative, not clickable */}
          {missionBar && (
            <g>
              <rect
                x={missionBar.x}
                y={missionBar.y}
                width={missionBar.width}
                height={missionBar.height}
                fill="#6B7280"
                rx={MISSION_BAR_HEIGHT / 10}
              />
              <text
                x={missionBar.x + missionBar.width / 2}
                y={missionBar.y + missionBar.height / 2 + MISSION_BAR_HEIGHT * 0.12}
                textAnchor="middle"
                fontSize={MISSION_BAR_HEIGHT * 0.35}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight={600}
                fill="white"
                pointerEvents="none"
                style={{ userSelect: "none" }}
              >
                {missionBar.title}
              </text>
            </g>
          )}

          {/* Block bars */}
          {bars.map((bar, i) => {
            const fontSize = bar.height * 0.45;

            return (
              <g key={bar.blockId + "-" + i} data-bar="true" style={{ cursor: "pointer" }}>
                <clipPath id={`clip-${bar.blockId}`}>
                  <rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} />
                </clipPath>
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  fill={getHeatHex(bar.heat)}
                  stroke="rgba(0,0,0,0.15)"
                  strokeWidth={bar.height * 0.02}
                  rx={Math.min(bar.height * 0.2, bar.width * 0.02)}
                  onClick={() =>
                    navigate(`/mission/${missionId}/block/${bar.blockId}`)
                  }
                  onMouseEnter={(e) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        text: bar.title,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top - 10,
                      });
                    }
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
                <text
                  clipPath={`url(#clip-${bar.blockId})`}
                  x={bar.x + bar.width / 2}
                  y={bar.y + bar.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fontFamily="ui-monospace, monospace"
                  fill="white"
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={fontSize * 0.04}
                  paintOrder="stroke"
                  fontWeight="600"
                  pointerEvents="none"
                  style={{ userSelect: "none" }}
                >
                  {bar.title}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-black/80 text-white text-xs px-2 py-1 rounded max-w-xs truncate z-50"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
        <button
          className="w-7 h-7 rounded bg-muted/80 hover:bg-muted text-foreground flex items-center justify-center text-sm font-mono border border-border/50"
          onClick={() =>
            setTransform((t) => ({
              ...t,
              scale: Math.min(200, t.scale * 1.3),
            }))
          }
        >
          +
        </button>
        <button
          className="w-7 h-7 rounded bg-muted/80 hover:bg-muted text-foreground flex items-center justify-center text-sm font-mono border border-border/50"
          onClick={() =>
            setTransform((t) => ({
              ...t,
              scale: Math.max(0.0005, t.scale / 1.3),
            }))
          }
        >
          -
        </button>
        <button
          className="w-7 h-7 rounded bg-muted/80 hover:bg-muted text-foreground flex items-center justify-center text-[10px] font-mono border border-border/50"
          title="Fit to view"
          onClick={handleFit}
        >
          fit
        </button>
      </div>
    </div>
  );
}

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
  const active = blocks.filter((b) => !b.completed_at);
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
      map.get(b.parent_block_id)!.children.push(node);
    } else {
      roots.push(node);
    }
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

const CANVAS_WIDTH = 1200;
const MISSION_BAR_HEIGHT = 40;

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

  // Filter to active blocks only
  const blocks = useMemo(
    () =>
      (allBlocks || []).filter(
        (b) =>
          !b.deleted_at &&
          !(b as any).is_files_block &&
          !(b as any).completed_at
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
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setTransform((t) => {
      const newScale = Math.max(0.05, Math.min(20, t.scale * factor));
      return {
        x: mx - (mx - t.x) * (newScale / t.scale),
        y: my - (my - t.y) * (newScale / t.scale),
        scale: newScale,
      };
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
          x: panStart.current.tx + dx,
          y: panStart.current.ty + dy,
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

  const showLabels = transform.scale >= 1.5;

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
          transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
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
                rx={3}
              />
              <text
                x={missionBar.x + missionBar.width / 2}
                y={missionBar.y + missionBar.height / 2 + 5}
                textAnchor="middle"
                fontSize={14}
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
            const fontSize = Math.min(bar.height * 0.6, 14);
            const maxChars = Math.max(
              3,
              Math.floor(bar.width / (fontSize * 0.6))
            );
            const label =
              bar.title.length > maxChars
                ? bar.title.slice(0, maxChars - 1) + "\u2026"
                : bar.title;

            return (
              <g key={bar.blockId + "-" + i} data-bar="true" style={{ cursor: "pointer" }}>
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  fill={getHeatHex(bar.heat)}
                  stroke="rgba(0,0,0,0.15)"
                  strokeWidth={0.5}
                  rx={Math.min(3, bar.height / 4)}
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
                {showLabels && bar.width > 20 && (
                  <text
                    x={bar.x + bar.width / 2}
                    y={bar.y + bar.height / 2 + fontSize / 3}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fontFamily="ui-monospace, monospace"
                    fill="white"
                    stroke="rgba(0,0,0,0.4)"
                    strokeWidth={0.3}
                    paintOrder="stroke"
                    pointerEvents="none"
                    style={{ userSelect: "none" }}
                  >
                    {label}
                  </text>
                )}
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
              scale: Math.min(20, t.scale * 1.3),
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
              scale: Math.max(0.05, t.scale / 1.3),
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

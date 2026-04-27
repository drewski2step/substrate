import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBlocks, BlockWithDeps } from "@/hooks/use-blocks";
import { Skeleton } from "@/components/ui/skeleton";

// --- Heat color (hex) matching BlockFlowChart ROYGBIV scale ---
function getHeatHex(heat: number): string {
  if (heat <= 0) return "#D1D5DB";
  if (heat <= 10) return "#EF4444";
  if (heat <= 25) return "#F97316";
  if (heat <= 50) return "#EAB308";
  if (heat <= 80) return "#22C55E";
  if (heat <= 120) return "#14B8A6";
  if (heat <= 170) return "#3B82F6";
  return "#8B5CF6";
}

// --- Tree node type ---
interface TreeNode {
  block: BlockWithDeps;
  children: TreeNode[];
}

// --- Build tree from flat block list using parent_block_id ---
function buildBlockTree(blocks: BlockWithDeps[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  blocks.forEach((b) => map.set(b.id, { block: b, children: [] }));

  const roots: TreeNode[] = [];
  blocks.forEach((b) => {
    const node = map.get(b.id)!;
    if (b.parent_block_id && map.has(b.parent_block_id)) {
      map.get(b.parent_block_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

// --- Point type ---
interface Pt {
  x: number;
  y: number;
}

// --- Bar descriptor for rendering ---
interface Bar {
  a: Pt;
  b: Pt;
  thickness: number;
  color: string;
  blockId: string;
  title: string;
  generation: number;
}

const MIN_LENGTH = 12;
const MIN_THICKNESS = 2;
const SPREAD_ANGLE = (60 * Math.PI) / 180; // 60° between siblings
const BASE_LENGTH = 200;
const BASE_THICKNESS = 14;
const CANVAS_CENTER: Pt = { x: 0, y: 0 }; // mutated by layoutRoots

// --- Helpers ---
function vecSub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}
function vecAdd(a: Pt, b: Pt): Pt {
  return { x: a.x + b.x, y: a.y + b.y };
}
function vecScale(v: Pt, s: number): Pt {
  return { x: v.x * s, y: v.y * s };
}
function vecLen(v: Pt): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}
function vecNorm(v: Pt): Pt {
  const l = vecLen(v);
  return l === 0 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}
/**
 * Children sprout from the MIDPOINT of the parent bar, fanning outward
 * perpendicular to the parent, away from the canvas center.
 *
 * childLength = parentLength * 0.55
 * Children are spaced 60° apart, centered on the outward perpendicular.
 */
function layoutChildren(
  a: Pt,
  b: Pt,
  children: TreeNode[],
  generation: number,
  thickness: number,
  bars: Bar[]
): void {
  const N = children.length;
  if (N === 0) return;

  const parentLength = vecLen(vecSub(b, a));
  const childLength = parentLength * 0.55;
  if (childLength < MIN_LENGTH) return; // too small to render

  const childThickness = Math.max(MIN_THICKNESS, thickness * 0.7);

  // Midpoint of parent bar
  const M: Pt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  // Outward direction: from canvas center toward midpoint
  const outward = vecNorm(vecSub(M, CANVAS_CENTER));
  // Fallback if midpoint is exactly at canvas center
  const perpAngle =
    outward.x === 0 && outward.y === 0
      ? Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2
      : Math.atan2(outward.y, outward.x);

  for (let i = 0; i < N; i++) {
    const offset = (-(N - 1) / 2 + i) * SPREAD_ANGLE;
    const childAngle = perpAngle + offset;
    const childDir: Pt = { x: Math.cos(childAngle), y: Math.sin(childAngle) };
    const childEnd: Pt = vecAdd(M, vecScale(childDir, childLength));

    const child = children[i];
    bars.push({
      a: M,
      b: childEnd,
      thickness: childThickness,
      color: getHeatHex(child.block.heat || 0),
      blockId: child.block.id,
      title: child.block.title,
      generation,
    });

    // Recurse with the child bar
    layoutChildren(M, childEnd, child.children, generation + 1, childThickness, bars);
  }
}

/**
 * Arrange M root blocks as edges of a regular M-gon centered at (cx, cy).
 */
function layoutRoots(roots: TreeNode[], cx: number, cy: number): Bar[] {
  const bars: Bar[] = [];
  const M = roots.length;

  // Update canvas center for outward direction calculation
  CANVAS_CENTER.x = cx;
  CANVAS_CENTER.y = cy;

  if (M === 0) return bars;

  if (M === 1) {
    // Single root: horizontal bar centered on canvas
    const a: Pt = { x: cx - BASE_LENGTH / 2, y: cy };
    const b: Pt = { x: cx + BASE_LENGTH / 2, y: cy };
    const root = roots[0];
    bars.push({
      a,
      b,
      thickness: BASE_THICKNESS,
      color: getHeatHex(root.block.heat || 0),
      blockId: root.block.id,
      title: root.block.title,
      generation: 0,
    });
    layoutChildren(a, b, root.children, 1, BASE_THICKNESS, bars);
    return bars;
  }

  // M >= 2: arrange as edges of a regular M-gon
  const radius = BASE_LENGTH / (2 * Math.sin(Math.PI / M));
  const vertices: Pt[] = [];
  for (let i = 0; i < M; i++) {
    const angle = (2 * Math.PI * i) / M - Math.PI / 2; // start from top
    vertices.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }

  for (let i = 0; i < M; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % M];
    const root = roots[i];
    bars.push({
      a,
      b,
      thickness: BASE_THICKNESS,
      color: getHeatHex(root.block.heat || 0),
      blockId: root.block.id,
      title: root.block.title,
      generation: 0,
    });
    layoutChildren(a, b, root.children, 1, BASE_THICKNESS, bars);
  }

  return bars;
}

// --- Compute bounding box for auto-fit ---
function computeBounds(bars: Bar[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const bar of bars) {
    const halfT = bar.thickness / 2;
    minX = Math.min(minX, bar.a.x - halfT, bar.b.x - halfT);
    minY = Math.min(minY, bar.a.y - halfT, bar.b.y - halfT);
    maxX = Math.max(maxX, bar.a.x + halfT, bar.b.x + halfT);
    maxY = Math.max(maxY, bar.a.y + halfT, bar.b.y + halfT);
  }
  return { minX, minY, maxX, maxY };
}

// --- Main component ---
export function KochFractalMap({ missionId }: { missionId: string }) {
  const navigate = useNavigate();
  const { data: allBlocks, isLoading } = useBlocks(missionId);
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [hasAutoFit, setHasAutoFit] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter out deleted and files blocks
  const blocks = useMemo(
    () => (allBlocks || []).filter((b) => !b.deleted_at && !(b as any).is_files_block),
    [allBlocks]
  );

  // Build tree and compute bars
  const bars = useMemo(() => {
    if (blocks.length === 0) return [];
    const roots = buildBlockTree(blocks);
    return layoutRoots(roots, 0, 0);
  }, [blocks]);

  // Auto-fit viewBox on first render
  useEffect(() => {
    if (bars.length === 0 || hasAutoFit) return;
    const container = containerRef.current;
    if (!container) return;
    const { minX, minY, maxX, maxY } = computeBounds(bars);
    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw === 0 || bh === 0) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const padding = 60;
    const scale = Math.min(cw / (bw + padding * 2), ch / (bh + padding * 2), 2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setTransform({
      x: cw / 2 - cx * scale,
      y: ch / 2 - cy * scale,
      scale,
    });
    setHasAutoFit(true);
  }, [bars, hasAutoFit]);

  // Reset auto-fit when mission changes
  useEffect(() => {
    setHasAutoFit(false);
  }, [missionId]);

  // Wheel zoom (keeping mouse point fixed)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setTransform((t) => {
        const newScale = Math.max(0.05, Math.min(10, t.scale * factor));
        return {
          x: mx - (mx - t.x) * (newScale / t.scale),
          y: my - (my - t.y) * (newScale / t.scale),
          scale: newScale,
        };
      });
    },
    []
  );

  // Pan via mouse drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // Only start pan if not clicking on a bar
      const target = e.target as SVGElement;
      if (target.closest("[data-bar]")) return;
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    },
    [transform]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setTransform((t) => ({
        ...t,
        x: panStart.current.tx + dx,
        y: panStart.current.ty + dy,
      }));
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Compute bar corners as a polygon for each bar (rotated rectangle)
  const renderBar = useCallback(
    (bar: Bar, i: number) => {
      const dir = vecNorm(vecSub(bar.b, bar.a));
      const perp = { x: -dir.y, y: dir.x };
      const halfT = bar.thickness / 2;
      const corners = [
        vecAdd(bar.a, vecScale(perp, halfT)),
        vecAdd(bar.b, vecScale(perp, halfT)),
        vecAdd(bar.b, vecScale(perp, -halfT)),
        vecAdd(bar.a, vecScale(perp, -halfT)),
      ];
      const points = corners.map((c) => `${c.x},${c.y}`).join(" ");

      // Label: centered on bar, rotated along bar direction
      const mid = { x: (bar.a.x + bar.b.x) / 2, y: (bar.a.y + bar.b.y) / 2 };
      const barLen = vecLen(vecSub(bar.b, bar.a));
      let angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
      // Keep text readable (not upside-down)
      if (angle > 90 || angle < -90) angle += 180;
      const fontSize = Math.max(8, Math.min(12, bar.thickness * 0.7));
      // Truncate title based on bar length
      const maxChars = Math.max(3, Math.floor(barLen / (fontSize * 0.55)));
      const label =
        bar.title.length > maxChars ? bar.title.slice(0, maxChars - 1) + "\u2026" : bar.title;

      return (
        <g key={i} data-bar="true" style={{ cursor: "pointer" }}>
          <polygon
            points={points}
            fill={bar.color}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={0.5}
            rx={2}
            onClick={() => navigate(`/block/${bar.blockId}`)}
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
          {barLen > 30 && (
            <text
              x={mid.x}
              y={mid.y}
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(${angle}, ${mid.x}, ${mid.y})`}
              fontSize={fontSize}
              fontFamily="ui-monospace, monospace"
              fill="white"
              stroke="rgba(0,0,0,0.5)"
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
    },
    [navigate]
  );

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
    <div ref={containerRef} className="relative w-full h-[500px] border border-dashed border-muted-foreground/20 rounded-lg overflow-hidden bg-background">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {bars.map(renderBar)}
        </g>
      </svg>
      {/* Tooltip overlay */}
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
              scale: Math.min(10, t.scale * 1.3),
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
          title="Reset view"
          onClick={() => setHasAutoFit(false)}
        >
          fit
        </button>
      </div>
    </div>
  );
}

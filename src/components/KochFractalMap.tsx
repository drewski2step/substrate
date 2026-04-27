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

const MIN_LENGTH = 10;
const BASE_LENGTH = 180;
const BASE_THICKNESS = 16;

// --- Vector helpers ---
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
  return l === 0 ? { x: 0, y: -1 } : { x: v.x / l, y: v.y / l };
}
function vecDot(a: Pt, b: Pt): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Build fractal edges using (N+1)-gon polygon construction.
 *
 * Each parent edge A->B with N children forms an (N+1)-gon where:
 * - The parent edge is one side of the polygon
 * - The N children are the remaining N sides
 * - The polygon grows outward (away from incomingDir)
 */
function buildFractalEdges(
  a: Pt,
  b: Pt,
  incomingDir: Pt,
  node: TreeNode,
  generation: number,
  thickness: number,
  bars: Bar[]
): void {
  const N = node.children.length;
  if (N === 0) return;

  const parentLength = vecLen(vecSub(b, a));
  const childLength = parentLength * 0.55;
  if (childLength < MIN_LENGTH) return;

  const childThickness = Math.max(2, thickness * 0.75);

  // Determine outward normal of AB (perpendicular, pointing away from incomingDir)
  const abVec = vecSub(b, a);
  const perp1: Pt = { x: -abVec.y, y: abVec.x }; // 90 deg CCW
  const perp2: Pt = { x: abVec.y, y: -abVec.x }; // 90 deg CW
  const awayDir = vecScale(incomingDir, -1); // opposite of incoming
  const outwardNormal = vecDot(perp1, awayDir) >= vecDot(perp2, awayDir)
    ? vecNorm(perp1)
    : vecNorm(perp2);

  if (N === 1) {
    // Special case: N=1 -> digon is degenerate
    // Single child extends from B in the outward perpendicular direction
    const childA = b;
    const childB = vecAdd(b, vecScale(outwardNormal, childLength));

    const child = node.children[0];
    bars.push({
      a: childA,
      b: childB,
      thickness: childThickness,
      color: getHeatHex(child.block.heat || 0),
      blockId: child.block.id,
      title: child.block.title,
      generation,
    });

    // Recurse: incoming direction for child is from B toward childB's start = normalize(B - A)
    const childIncoming = vecNorm(vecSub(childA, a));
    buildFractalEdges(childA, childB, childIncoming, child, generation + 1, childThickness, bars);
    return;
  }

  // N >= 2: Build an (N+1)-gon with AB as one side, children as remaining N sides
  const sides = N + 1;
  const L = childLength; // side length for child edges
  const R = L / (2 * Math.sin(Math.PI / sides)); // circumradius

  // Midpoint of AB
  const M: Pt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

  // Distance from midpoint of AB to polygon center along perpendicular bisector
  // The parent edge AB has length parentLength, but the polygon sides have length childLength
  // We need the polygon center such that all vertices are at distance R from center
  // and vertex[0]=A, vertex[1]=B... but A and B have distance parentLength apart,
  // while the polygon has side length childLength.
  //
  // Actually: the polygon's sides all have length childLength, but AB (the parent) is not
  // necessarily equal to childLength. We construct the (N+1)-gon with side = childLength,
  // positioned so that its first edge starts at B and the polygon closes back to A.
  //
  // Better approach: compute polygon vertices directly by stepping angles from B around
  // the polygon center, where the center is positioned on the perpendicular bisector of AB
  // on the outward side.
  //
  // Since the parent edge AB may differ in length from childLength, we position the
  // polygon center based on AB as a chord of the circumscribed circle of the (N+1)-gon.
  // But this only works if parentLength <= 2R. Let's use the approach where:
  // - The polygon center lies on the perpendicular bisector of AB
  // - At distance d from M, where d = sqrt(R^2 - (parentLength/2)^2)
  //   (treating AB as a chord of the circumcircle)
  // If parentLength > 2R (chord longer than diameter), we clamp.

  const halfParent = parentLength / 2;
  const dSquared = R * R - halfParent * halfParent;
  const d = dSquared > 0 ? Math.sqrt(dSquared) : 0;

  // Polygon center on the outward side
  const center: Pt = vecAdd(M, vecScale(outwardNormal, d));

  // Compute angles from center to A and B
  const thetaA = Math.atan2(a.y - center.y, a.x - center.x);
  const thetaB = Math.atan2(b.y - center.y, b.x - center.x);

  // Angular step for the polygon
  const step = (2 * Math.PI) / sides;

  // Determine rotation direction: we want to go from B toward the new vertices
  // on the OUTWARD side (away from A going the long way around).
  // Test both directions and pick the one where vertex[2] is on the outward side.
  const testCW = thetaB - step;
  const testCCW = thetaB + step;
  const ptCW: Pt = { x: center.x + R * Math.cos(testCW), y: center.y + R * Math.sin(testCW) };
  const ptCCW: Pt = { x: center.x + R * Math.cos(testCCW), y: center.y + R * Math.sin(testCCW) };

  // The correct direction is the one where the first new vertex is NOT near A
  // (i.e., we go the long way around from B back to A)
  const distCW_A = vecLen(vecSub(ptCW, a));
  const distCCW_A = vecLen(vecSub(ptCCW, a));

  // If N+1 = 2 sides, both directions lead back to A immediately, so pick outward
  let stepDir: number;
  if (sides === 2) {
    // Shouldn't reach here (handled by N=1 above), but safety
    stepDir = step;
  } else {
    // Pick direction where first new vertex is farther from A (going the long way)
    stepDir = distCW_A > distCCW_A ? -step : step;
  }

  // Build polygon vertices: vertex[0] = A, vertex[1] = B, vertex[2..N] = new
  const vertices: Pt[] = [a, b];
  const actualR = vecLen(vecSub(b, center)); // use actual radius from center to B
  for (let k = 1; k <= N - 1; k++) {
    const angle = thetaB + k * stepDir;
    vertices.push({
      x: center.x + actualR * Math.cos(angle),
      y: center.y + actualR * Math.sin(angle),
    });
  }
  // The last child edge goes from vertex[N] back to A, so we don't need vertex[N+1]

  // Create child edges:
  // Child 0: B -> vertex[2]
  // Child 1: vertex[2] -> vertex[3]
  // ...
  // Child N-1: vertex[N] -> A
  for (let i = 0; i < N; i++) {
    const child = node.children[i];
    let edgeA: Pt, edgeB: Pt;
    if (i === 0) {
      edgeA = b;
      edgeB = vertices[2];
    } else if (i === N - 1) {
      edgeA = vertices[i + 1];
      edgeB = a;
    } else {
      edgeA = vertices[i + 1];
      edgeB = vertices[i + 2];
    }

    bars.push({
      a: edgeA,
      b: edgeB,
      thickness: childThickness,
      color: getHeatHex(child.block.heat || 0),
      blockId: child.block.id,
      title: child.block.title,
      generation,
    });

    // Recurse: incoming direction = from polygon center through edgeA (outward from center)
    const childIncoming = vecNorm(vecSub(edgeA, center));
    buildFractalEdges(edgeA, edgeB, childIncoming, child, generation + 1, childThickness, bars);
  }
}

/**
 * Arrange M root blocks as edges of a regular M-gon centered at (cx, cy).
 * For each root edge, the incoming direction points toward canvas center (inward),
 * so children grow outward.
 */
function layoutRoots(roots: TreeNode[], cx: number, cy: number): Bar[] {
  const bars: Bar[] = [];
  const M = roots.length;
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
    // Incoming direction for single root: pointing down (toward canvas center from above)
    // so children grow upward
    const incomingDir: Pt = { x: 0, y: 1 };
    buildFractalEdges(a, b, incomingDir, root, 1, BASE_THICKNESS, bars);
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
    // Incoming direction: from edge midpoint toward canvas center (inward)
    const mid: Pt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const incomingDir = vecNorm(vecSub({ x: cx, y: cy }, mid));
    buildFractalEdges(a, b, incomingDir, root, 1, BASE_THICKNESS, bars);
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

  // Filter out deleted, completed, and files blocks
  const blocks = useMemo(
    () => (allBlocks || []).filter((b) => !b.deleted_at && !(b as any).is_files_block && !(b as any).completed_at),
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

  // Render a bar as a rotated <rect> centered on edge midpoint
  const renderBar = useCallback(
    (bar: Bar, i: number) => {
      const dx = bar.b.x - bar.a.x;
      const dy = bar.b.y - bar.a.y;
      const barLen = Math.sqrt(dx * dx + dy * dy);
      const midX = (bar.a.x + bar.b.x) / 2;
      const midY = (bar.a.y + bar.b.y) / 2;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      // Text label: only show when zoom scale >= 1.5
      const showLabel = transform.scale >= 1.5;
      const fontSize = Math.max(8, Math.min(12, bar.thickness * 0.7));
      const maxChars = Math.max(3, Math.floor(barLen / (fontSize * 0.55)));
      const label =
        bar.title.length > maxChars ? bar.title.slice(0, maxChars - 1) + "\u2026" : bar.title;
      // Keep text readable (not upside-down)
      let textAngle = angle;
      if (textAngle > 90 || textAngle < -90) textAngle += 180;

      return (
        <g key={i} data-bar="true" style={{ cursor: "pointer" }}>
          <rect
            x={midX - barLen / 2}
            y={midY - bar.thickness / 2}
            width={barLen}
            height={bar.thickness}
            transform={`rotate(${angle}, ${midX}, ${midY})`}
            fill={bar.color}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth={0.5}
            rx={bar.thickness / 2}
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
          {showLabel && barLen > 30 && (
            <text
              x={midX}
              y={midY}
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(${textAngle}, ${midX}, ${midY})`}
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
    [navigate, transform.scale]
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

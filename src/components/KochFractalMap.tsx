import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBlocks, BlockWithDeps } from "@/hooks/use-blocks";
import { useGoal } from "@/hooks/use-goals";
import { Skeleton } from "@/components/ui/skeleton";

// --- Constants ---
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const H_GAP = 40;
const V_GAP = 80;

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
  const allBlockIds = new Set(blocks.map((b) => b.id));
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
    } else if (!b.parent_block_id || !allBlockIds.has(b.parent_block_id)) {
      roots.push(node);
    }
  });
  return roots;
}

// --- Layout algorithm (Reingold-Tilford simplified) ---
function computeSubtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) return NODE_WIDTH;
  const childrenWidth =
    node.children.reduce((sum, c) => sum + computeSubtreeWidth(c), 0) +
    H_GAP * (node.children.length - 1);
  return Math.max(NODE_WIDTH, childrenWidth);
}

interface NodePosition {
  x: number;
  y: number;
}

function assignPositions(
  node: TreeNode,
  centerX: number,
  y: number,
  positions: Map<string, NodePosition>
): void {
  positions.set(node.id, { x: centerX, y });
  const N = node.children.length;
  if (N === 0) return;

  const totalWidth =
    node.children.reduce((sum, c) => sum + computeSubtreeWidth(c), 0) +
    H_GAP * (N - 1);
  let startX = centerX - totalWidth / 2;

  node.children.forEach((child) => {
    const childSubtreeWidth = computeSubtreeWidth(child);
    assignPositions(
      child,
      startX + childSubtreeWidth / 2,
      y + NODE_HEIGHT + V_GAP,
      positions
    );
    startX += childSubtreeWidth + H_GAP;
  });
}

// --- Collect all edges (parent→child) ---
interface Edge {
  parentId: string;
  childId: string;
}

function collectEdges(node: TreeNode, edges: Edge[]): void {
  node.children.forEach((child) => {
    edges.push({ parentId: node.id, childId: child.id });
    collectEdges(child, edges);
  });
}

// --- Truncate text to fit node ---
const MAX_CHARS = Math.floor(NODE_WIDTH / 8);
function truncateTitle(title: string): string {
  if (title.length <= MAX_CHARS) return title;
  return title.slice(0, MAX_CHARS - 3) + "...";
}

export function KochFractalMap({ missionId }: { missionId: string }) {
  const navigate = useNavigate();
  const { data: goal } = useGoal(missionId);
  const { data: allBlocks, isLoading } = useBlocks(missionId);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hasAutoFit, setHasAutoFit] = useState(false);

  // Filter to displayable blocks
  const blocks = useMemo(
    () =>
      (allBlocks || []).filter(
        (b) => !b.deleted_at && !(b as any).is_files_block
      ),
    [allBlocks]
  );

  // Build tree, compute positions and edges
  const { positions, edges, roots, totalTreeWidth, totalTreeHeight } =
    useMemo(() => {
      const empty = {
        positions: new Map<string, NodePosition>(),
        edges: [] as Edge[],
        roots: [] as TreeNode[],
        totalTreeWidth: 0,
        totalTreeHeight: 0,
      };
      if (blocks.length === 0) return empty;

      const roots = buildBlockTree(blocks);
      if (roots.length === 0) return empty;

      // Compute total width of all root subtrees
      const rootWidths = roots.map((r) => computeSubtreeWidth(r));
      const totalTreeWidth =
        rootWidths.reduce((sum, w) => sum + w, 0) +
        H_GAP * (roots.length - 1);

      // Mission node position
      const missionY = 40;
      const missionCenterX = totalTreeWidth / 2;

      // Assign positions for each root subtree
      const positions = new Map<string, NodePosition>();
      let startX = 0;
      roots.forEach((root, i) => {
        const rootSubtreeWidth = rootWidths[i];
        assignPositions(
          root,
          startX + rootSubtreeWidth / 2,
          missionY + NODE_HEIGHT + V_GAP,
          positions
        );
        startX += rootSubtreeWidth + H_GAP;
      });

      // Collect all parent→child edges
      const edges: Edge[] = [];
      roots.forEach((root) => collectEdges(root, edges));

      // Add mission→root edges (using special id)
      roots.forEach((root) => {
        edges.push({ parentId: "__mission__", childId: root.id });
      });

      // Store mission node position
      positions.set("__mission__", { x: missionCenterX, y: missionY });

      // Compute total tree height
      let maxY = missionY + NODE_HEIGHT;
      positions.forEach((pos) => {
        maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
      });

      return {
        positions,
        edges,
        roots,
        totalTreeWidth,
        totalTreeHeight: maxY + 40,
      };
    }, [blocks]);

  // Auto-fit on load
  useEffect(() => {
    if (positions.size === 0 || hasAutoFit) return;
    const container = containerRef.current;
    if (!container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const padding = 40;

    const tw = totalTreeWidth + NODE_WIDTH;
    const th = totalTreeHeight;
    if (tw === 0 || th === 0) return;

    const scale = Math.min(
      (cw - padding * 2) / tw,
      (ch - padding * 2) / th
    );
    const fitZoom = Math.max(0.05, Math.min(20, scale));
    const fitPanX = (cw - tw * fitZoom) / 2;
    const fitPanY = (ch - th * fitZoom) / 2;

    setZoom(fitZoom);
    setPan({ x: fitPanX, y: fitPanY });
    setHasAutoFit(true);
  }, [positions, totalTreeWidth, totalTreeHeight, hasAutoFit]);

  // Reset auto-fit on mission change
  useEffect(() => {
    setHasAutoFit(false);
  }, [missionId]);

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
    const factor = Math.pow(0.999, e.deltaY);

    setZoom((prevZoom) => {
      const newZoom = Math.max(0.05, Math.min(20, prevZoom * factor));
      setPan((prevPan) => ({
        x: mx - (mx - prevPan.x) * (newZoom / prevZoom),
        y: my - (my - prevPan.y) * (newZoom / prevZoom),
      }));
      return newZoom;
    });
  }, []);

  // Pan via mouse drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as SVGElement;
      if (target.closest("[data-node]")) return;
      setIsPanning(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        px: pan.x,
        py: pan.y,
      };
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setPan({
          x: panStart.current.px + dx,
          y: panStart.current.py + dy,
        });
      }
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

  const missionPos = positions.get("__mission__");
  const missionTitle = goal?.title ?? "Mission";

  return (
    <div
      ref={containerRef}
      className="relative w-full border border-dashed border-muted-foreground/20 rounded-lg overflow-hidden bg-background"
      style={{ height: "calc(100vh - 160px)" }}
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
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Connector lines (drawn first so nodes appear on top) */}
          {edges.map((edge, i) => {
            const parentPos = positions.get(edge.parentId);
            const childPos = positions.get(edge.childId);
            if (!parentPos || !childPos) return null;

            const x1 = parentPos.x;
            const y1 = parentPos.y + NODE_HEIGHT / 2;
            const x2 = childPos.x;
            const y2 = childPos.y - NODE_HEIGHT / 2;
            const midY = (y1 + y2) / 2;

            return (
              <path
                key={`edge-${i}`}
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth={1.5}
              />
            );
          })}

          {/* Mission node */}
          {missionPos && (
            <g>
              <rect
                x={missionPos.x - NODE_WIDTH / 2}
                y={missionPos.y - NODE_HEIGHT / 2}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                fill="#6B7280"
                rx={8}
              />
              <text
                x={missionPos.x}
                y={missionPos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                fontWeight={600}
                fill="white"
                pointerEvents="none"
                style={{ userSelect: "none" }}
              >
                {truncateTitle(missionTitle)}
              </text>
            </g>
          )}

          {/* Block nodes */}
          {Array.from(positions.entries())
            .filter(([id]) => id !== "__mission__")
            .map(([id, pos]) => {
              const block = blocks.find((b) => b.id === id);
              if (!block) return null;
              const heat = block.heat ?? 0;
              const fillColor = getHeatHex(heat);
              const isHovered = hoveredId === id;

              return (
                <g
                  key={id}
                  data-node="true"
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    navigate(`/mission/${missionId}/block/${id}`)
                  }
                  onMouseEnter={(e) => {
                    setHoveredId(id);
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        text: block.title,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top - 10,
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredId(null);
                    setTooltip(null);
                  }}
                >
                  <rect
                    x={pos.x - NODE_WIDTH / 2}
                    y={pos.y - NODE_HEIGHT / 2}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    fill={fillColor}
                    rx={8}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                    opacity={isHovered ? 0.85 : 1}
                  />
                  <text
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={12}
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fontWeight={500}
                    fill="white"
                    pointerEvents="none"
                    style={{ userSelect: "none" }}
                  >
                    {truncateTitle(block.title)}
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
            setZoom((z) => Math.min(20, z * 1.3))
          }
        >
          +
        </button>
        <button
          className="w-7 h-7 rounded bg-muted/80 hover:bg-muted text-foreground flex items-center justify-center text-sm font-mono border border-border/50"
          onClick={() =>
            setZoom((z) => Math.max(0.05, z / 1.3))
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

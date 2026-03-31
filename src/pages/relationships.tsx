import { useRelationships } from "@/hooks/use-relationships";
import { useDatasets } from "@/hooks/use-datasets";
import { useModel } from "@/providers/model-context";
import { useState, useMemo } from "react";
import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  Controls,
  MiniMap,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;

function layoutGraph(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 100 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return {
    nodes: nodes.map((node) => {
      const pos = g.node(node.id);
      return {
        ...node,
        position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      };
    }),
    edges,
  };
}

export function RelationshipsPage() {
  const { modelUUID } = useModel();
  const { data: relationships, isLoading: relLoading } = useRelationships(modelUUID);
  const { data: datasets, isLoading: dsLoading } = useDatasets(modelUUID);
  const [view, setView] = useState<"graph" | "table">("graph");

  const { nodes, edges } = useMemo(() => {
    if (!datasets?.length || !relationships?.length)
      return { nodes: [] as Node[], edges: [] as Edge[] };

    const rawNodes: Node[] = datasets.map((d) => ({
      id: d.attributes.tableId,
      data: {
        label: d.attributes.name,
      },
      position: { x: 0, y: 0 },
      style: {
        background: "white",
        border: "1px solid #d4d4d4",
        borderRadius: "6px",
        padding: "6px 10px",
        width: NODE_WIDTH,
        fontSize: "11px",
        fontWeight: 500,
      },
    }));

    const rawEdges: Edge[] = relationships.map((r) => ({
      id: r.id,
      source: r.attributes.from,
      target: r.attributes.to,
      label: r.attributes.type || "left",
      style: {
        stroke: r.attributes.type === "inner" ? "#22c55e" : "#93c5fd",
        strokeWidth: 1.5,
      },
      labelStyle: { fontSize: 9, fill: "#737373" },
      labelBgStyle: { fill: "#fff", fillOpacity: 0.9 },
      type: "smoothstep",
    }));

    return layoutGraph(rawNodes, rawEdges);
  }, [datasets, relationships]);

  const isLoading = relLoading || dsLoading;

  if (isLoading) {
    return <div className="animate-pulse h-96 bg-muted rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Relationships{" "}
          <span className="text-muted-foreground font-normal text-sm">
            ({relationships?.length || 0})
          </span>
        </h2>
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          <button
            onClick={() => setView("graph")}
            className={`px-3 py-1 text-xs rounded ${view === "graph" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Graph
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1 text-xs rounded ${view === "table" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Table
          </button>
        </div>
      </div>

      {view === "graph" ? (
        <div className="border border-border rounded-lg overflow-hidden" style={{ height: "600px" }}>
          {nodes.length > 0 ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              proOptions={{ hideAttribution: true }}
              nodesDraggable
              nodesConnectable={false}
              minZoom={0.2}
              maxZoom={2}
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor="#e5e5e5"
                maskColor="rgba(0,0,0,0.05)"
                style={{ height: 80, width: 120 }}
              />
            </ReactFlow>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No relationships to display
            </div>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap">Name</th>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap">Type</th>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap">From</th>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap">To</th>
                <th className="text-left px-4 py-2 font-medium whitespace-nowrap">ON</th>
              </tr>
            </thead>
            <tbody>
              {relationships?.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium whitespace-nowrap">{r.attributes.name || "-"}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.attributes.type === "inner" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
                      {r.attributes.type || "left"}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{r.attributes.from}</td>
                  <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{r.attributes.to}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {r.attributes.on}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

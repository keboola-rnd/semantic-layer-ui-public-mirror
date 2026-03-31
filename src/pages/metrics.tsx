import { useMetrics, useCreateMetric } from "@/hooks/use-metrics";
import { useDatasets } from "@/hooks/use-datasets";
import { useModel } from "@/providers/model-context";
import { Link } from "react-router";
import { truncate } from "@/lib/utils";
import { RevisionBadge } from "@/components/shared/object-meta";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";

export function MetricsPage() {
  const { modelUUID } = useModel();
  const { data: metrics, isLoading } = useMetrics(modelUUID);
  const { data: datasets } = useDatasets(modelUUID);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSql, setNewSql] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDataset, setNewDataset] = useState("");
  const createMetric = useCreateMetric();

  const filtered = metrics?.filter(
    (m) =>
      m.attributes.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.attributes.description || "").toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Metrics{" "}
          <span className="text-muted-foreground font-normal text-sm">
            ({filtered?.length || 0})
          </span>
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search metrics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-sm border border-input rounded-md bg-background w-64 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Add Metric
          </button>
        </div>
      </div>

      {/* Create Metric Form */}
      {showCreate && (
        <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">New Metric</h3>
            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="metric_name" className="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Dataset</label>
              <select value={newDataset} onChange={(e) => setNewDataset(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background">
                <option value="">Select dataset...</option>
                {datasets?.map((d) => (
                  <option key={d.id} value={d.attributes.tableId}>{d.attributes.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Description</label>
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does this metric measure?" className="w-full px-2 py-1.5 text-sm border border-input rounded-md bg-background" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">SQL Expression</label>
            <div className="border border-input rounded-md overflow-hidden">
              <CodeMirror value={newSql} onChange={setNewSql} extensions={[sql()]} height="80px" theme="light" />
            </div>
          </div>
          <button
            onClick={() => {
              if (!newName || !newSql) return;
              createMetric.mutate({ modelUUID, name: newName, sql: newSql, description: newDesc, dataset: newDataset || undefined }, {
                onSuccess: () => { setShowCreate(false); setNewName(""); setNewSql(""); setNewDesc(""); setNewDataset(""); },
              });
            }}
            disabled={!newName || !newSql || createMetric.isPending}
            className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {createMetric.isPending ? "Creating..." : "Create Metric"}
          </button>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-3 py-2 font-medium w-[160px]">Name</th>
              <th className="text-left px-3 py-2 font-medium">SQL</th>
              <th className="text-left px-3 py-2 font-medium w-[140px]">Dataset</th>
              <th className="text-right px-3 py-2 font-medium w-[120px]">Version</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map((m) => (
              <tr
                key={m.id}
                className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-3 py-2.5">
                  <Link
                    to={`/metrics/${m.id}`}
                    className="font-medium text-primary hover:underline block"
                  >
                    {m.attributes.name}
                  </Link>
                  {m.attributes.description && (
                    <span className="text-[10px] text-muted-foreground">
                      {truncate(m.attributes.description, 60)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    {truncate(m.attributes.sql, 60)}
                  </code>
                </td>
                <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground">
                  {m.attributes.dataset ? m.attributes.dataset.split(".").pop() : "-"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <RevisionBadge revision={m.meta.revision} updatedAt={m.meta.lastUpdated} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState } from "react";
import { ChevronDown, ChevronRight, Sparkles, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_COLORS, TYPE_COLORS } from "@/lib/constants";
import type { DatasetField } from "@/lib/types";

interface Dataset {
  tableId: string;
  name: string;
  description: string;
  fqn: string;
  grain: string;
  primaryKey?: string[];
  fields: Array<{ name: string; role: string; type: string; description: string }>;
  _heuristic?: boolean;
  _aiEnhanced?: boolean;
}

export function StepDatasets({
  datasets,
  onDatasetsChange,
  aiProgress,
  onNext,
  onBack,
}: {
  datasets: Dataset[];
  onDatasetsChange: (ds: Dataset[]) => void;
  aiProgress: { completed: number; total: number } | null;
  onNext: () => void;
  onBack: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  function toggleExpand(id: string) {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  }

  function updateField(dsIndex: number, fieldIndex: number, updates: Partial<DatasetField>) {
    const next = [...datasets];
    const fields = [...(next[dsIndex].fields || [])];
    fields[fieldIndex] = { ...fields[fieldIndex], ...updates };
    next[dsIndex] = { ...next[dsIndex], fields };
    onDatasetsChange(next);
  }

  function removeDataset(dsIndex: number) {
    onDatasetsChange(datasets.filter((_, i) => i !== dsIndex));
  }

  const filtered = datasets.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.tableId.toLowerCase().includes(search.toLowerCase())
  );

  const aiEnhancedCount = datasets.filter((d) => d._aiEnhanced).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Review Datasets & Fields</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {datasets.length} datasets from your project.
            {aiProgress && aiProgress.completed < aiProgress.total && (
              <span className="inline-flex items-center gap-1 ml-2 text-purple-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI enhancing ({aiProgress.completed}/{aiProgress.total})...
              </span>
            )}
            {aiEnhancedCount > 0 && !aiProgress && (
              <span className="ml-2 text-purple-600">{aiEnhancedCount} AI-enhanced</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Filter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-2 py-1 text-xs border border-input rounded-md bg-background w-40"
          />
          <button
            onClick={() => setExpanded(new Set(filtered.map((d) => d.tableId)))}
            className="text-xs text-muted-foreground hover:text-foreground px-2"
          >
            Expand all
          </button>
        </div>
      </div>

      {/* AI progress bar */}
      {aiProgress && aiProgress.total > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-xs text-purple-700 mb-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            AI is enriching your datasets with better descriptions and classifications...
          </div>
          <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${(aiProgress.completed / aiProgress.total) * 100}%` }}
            />
          </div>
          <div className="text-[10px] text-purple-500 mt-1">
            {aiProgress.completed}/{aiProgress.total} tables classified
          </div>
        </div>
      )}

      {/* Dataset cards */}
      <div className="space-y-2">
        {filtered.map((ds, dsIndex) => {
          const realIndex = datasets.indexOf(ds);
          const isExpanded = expanded.has(ds.tableId);
          const fields = ds.fields || [];
          const roleCounts: Record<string, number> = {};
          for (const f of fields) roleCounts[f.role || "unknown"] = (roleCounts[f.role || "unknown"] || 0) + 1;

          return (
            <div
              key={ds.tableId}
              className={cn(
                "border rounded-lg transition-all",
                ds._aiEnhanced ? "border-purple-200 bg-purple-50/20" : "border-border"
              )}
            >
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30"
                onClick={() => toggleExpand(ds.tableId)}
              >
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{ds.name}</span>
                    {ds._aiEnhanced && <Sparkles className="h-3 w-3 text-purple-500" />}
                    {ds._heuristic && <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">heuristic</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">{ds.tableId}</div>
                </div>
                <div className="flex gap-1">
                  {Object.entries(roleCounts).map(([role, count]) => (
                    <span key={role} className={cn("text-[10px] px-1.5 py-0.5 rounded border", ROLE_COLORS[role] || "bg-gray-100")}>
                      {count} {role}
                    </span>
                  ))}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeDataset(realIndex); }}
                  className="text-muted-foreground hover:text-destructive ml-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="text-left px-3 py-1.5 font-medium">Field</th>
                        <th className="text-left px-3 py-1.5 font-medium w-[100px]">Role</th>
                        <th className="text-left px-3 py-1.5 font-medium w-[100px]">Type</th>
                        <th className="text-left px-3 py-1.5 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f, fi) => (
                        <tr key={f.name} className="border-t border-border hover:bg-muted/10">
                          <td className="px-3 py-1.5 font-mono">{f.name}</td>
                          <td className="px-3 py-1.5">
                            <select
                              value={f.role || "dimension"}
                              onChange={(e) => updateField(realIndex, fi, { role: e.target.value as DatasetField["role"] })}
                              className={cn("text-[10px] px-1 py-0.5 rounded border bg-transparent", ROLE_COLORS[f.role || ""])}
                            >
                              <option value="key">key</option>
                              <option value="dimension">dimension</option>
                              <option value="measure">measure</option>
                              <option value="timestamp">timestamp</option>
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              value={f.type || "string"}
                              onChange={(e) => updateField(realIndex, fi, { type: e.target.value as DatasetField["type"] })}
                              className={cn("text-[10px] px-1 py-0.5 rounded", TYPE_COLORS[f.type || ""])}
                            >
                              <option value="string">string</option>
                              <option value="integer">integer</option>
                              <option value="decimal">decimal</option>
                              <option value="boolean">boolean</option>
                              <option value="date">date</option>
                              <option value="datetime">datetime</option>
                              <option value="json">json</option>
                            </select>
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">{f.description || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent">Back</button>
        <button onClick={onNext} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
          Continue to Metrics
        </button>
      </div>
    </div>
  );
}

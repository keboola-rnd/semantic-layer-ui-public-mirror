import { useState, useEffect } from "react";
import { Loader2, ChevronDown, ChevronRight, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_COLORS, TYPE_COLORS } from "@/lib/constants";
import type { SemanticDataset, DatasetField } from "@/lib/types";

interface ClassifyResult {
  datasets: SemanticDataset[];
  metrics: Array<{ name: string; sql: string; dataset: string; description: string }>;
  relationships: Array<{ name: string; from: string; to: string; on: string; type: string }>;
  glossary: Array<{ term: string; definition: string; seeAlso: string[] }>;
}

export function StepDatasets({
  tableIds,
  storageUrl,
  projectName,
  sqlDialect,
  classifyResult,
  autoStart,
  onStarted,
  onClassified,
  onNext,
  onBack,
}: {
  tableIds: string[];
  storageUrl: string;
  projectName: string;
  sqlDialect: string;
  classifyResult: ClassifyResult | null;
  autoStart: boolean;
  onStarted: () => void;
  onClassified: (result: ClassifyResult) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [datasets, setDatasets] = useState<SemanticDataset[]>(classifyResult?.datasets || []);

  // Auto-classify once — controlled by parent to prevent re-fires on remount
  useEffect(() => {
    if (autoStart && !classifyResult && tableIds.length > 0) {
      onStarted(); // Tell parent we've started — prevents re-fire
      handleClassify();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClassify() {
    setLoading(true);
    setError("");
    try {
      // Step 1: Fetch table details
      setStatus(`Fetching details for ${tableIds.length} tables...`);
      const detailResp = await fetch("/backend/introspect/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableIds, storageUrl }),
      });
      if (!detailResp.ok) {
        const text = await detailResp.text();
        throw new Error(text.startsWith("<") ? `Server error (${detailResp.status}). Check data app logs.` : text);
      }
      const tables = await detailResp.json();
      const tableCount = Object.keys(tables).length;

      // Step 2: Classify with AI
      setStatus(`AI is classifying ${tableCount} tables...`);
      const classifyResp = await fetch("/backend/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables, projectName, sqlDialect }),
      });
      if (!classifyResp.ok) {
        const text = await classifyResp.text();
        throw new Error(text.startsWith("<") ? `Classification timed out or failed (${classifyResp.status}). Try selecting fewer buckets.` : text);
      }
      const result = await classifyResp.json();
      setDatasets(result.datasets || []);
      onClassified(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Classification failed");
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  function toggleExpand(tableId: string) {
    const next = new Set(expanded);
    next.has(tableId) ? next.delete(tableId) : next.add(tableId);
    setExpanded(next);
  }

  function updateField(dsIndex: number, fieldIndex: number, updates: Partial<DatasetField>) {
    const next = [...datasets];
    const fields = [...(next[dsIndex].fields || [])];
    fields[fieldIndex] = { ...fields[fieldIndex], ...updates };
    next[dsIndex] = { ...next[dsIndex], fields };
    setDatasets(next);
  }

  function removeDataset(dsIndex: number) {
    setDatasets(datasets.filter((_, i) => i !== dsIndex));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Review Datasets & Fields</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {datasets.length > 0
              ? `AI has classified ${datasets.length} datasets. Review and edit roles and types.`
              : loading
                ? "Discovering and classifying your data..."
                : "AI will classify your tables."}
          </p>
        </div>
        {datasets.length > 0 && (
          <button
            onClick={() => setExpanded(new Set(datasets.map((d) => d.tableId)))}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Expand all
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <div>
            <div className="text-sm font-medium">{status}</div>
            <div className="text-xs">This may take up to a minute for large projects</div>
          </div>
        </div>
      )}

      {error && (
        <div className="border border-destructive/50 bg-destructive/5 rounded-lg p-4">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => handleClassify()}
            className="text-xs underline mt-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Dataset cards */}
      <div className="space-y-2">
        {datasets.map((ds, dsIndex) => {
          const isExpanded = expanded.has(ds.tableId);
          const fields = ds.fields || [];
          const roleCounts: Record<string, number> = {};
          for (const f of fields) {
            const r = f.role || "unknown";
            roleCounts[r] = (roleCounts[r] || 0) + 1;
          }

          return (
            <div key={ds.tableId} className="border border-border rounded-lg">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30"
                onClick={() => toggleExpand(ds.tableId)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{ds.name}</span>
                    <Sparkles className="h-3 w-3 text-purple-500" />
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">{ds.tableId}</div>
                </div>
                <div className="flex gap-1">
                  {Object.entries(roleCounts).map(([role, count]) => (
                    <span
                      key={role}
                      className={cn("text-[10px] px-1.5 py-0.5 rounded border", ROLE_COLORS[role] || "bg-gray-100")}
                    >
                      {count} {role}
                    </span>
                  ))}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeDataset(dsIndex); }}
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
                              onChange={(e) => updateField(dsIndex, fi, { role: e.target.value as DatasetField["role"] })}
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
                              onChange={(e) => updateField(dsIndex, fi, { type: e.target.value as DatasetField["type"] })}
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

      {datasets.length > 0 && (
        <div className="flex gap-2">
          <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent">
            Back
          </button>
          <button onClick={onNext} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            Continue to Metrics
          </button>
        </div>
      )}
    </div>
  );
}

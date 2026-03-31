import { useState } from "react";
import { Loader2, Search, CheckSquare, Square } from "lucide-react";

interface Bucket {
  id: string;
  name: string;
  description: string;
  displayName: string;
}

interface TableSummary {
  id: string;
  name: string;
  rowsCount: number;
}

interface IntrospectResult {
  projectId: string;
  projectName: string;
  sqlDialect: string;
  storageUrl: string;
  buckets: Bucket[];
  tablesByBucket: Record<string, TableSummary[]>;
  totalTables: number;
}

export interface ProjectStepData {
  modelName: string;
  modelDescription: string;
  sqlDialect: "Snowflake" | "BigQuery";
  introspection: IntrospectResult | null;
  selectedBuckets: string[];
  selectedTableIds: string[];
}

export function StepProject({
  data,
  onChange,
  onNext,
  loading: externalLoading,
}: {
  data: ProjectStepData;
  onChange: (d: ProjectStepData) => void;
  onNext: () => void;
  loading?: boolean;
  error?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingTables, setLoadingTables] = useState(false);

  async function handleIntrospect() {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/backend/introspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || `Failed: ${resp.status}`);
      }
      const result: IntrospectResult = await resp.json();

      // Auto-set model name from project
      const autoName = result.projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");

      // Select all buckets by default
      const allBucketIds = result.buckets.map((b) => b.id);

      onChange({
        ...data,
        modelName: data.modelName || autoName,
        sqlDialect: result.sqlDialect as "Snowflake" | "BigQuery",
        introspection: result,
        selectedBuckets: allBucketIds,
        selectedTableIds: [],
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Introspection failed");
    } finally {
      setLoading(false);
    }
  }

  function toggleBucket(bucketId: string) {
    const selected = data.selectedBuckets.includes(bucketId)
      ? data.selectedBuckets.filter((b) => b !== bucketId)
      : [...data.selectedBuckets, bucketId];
    onChange({ ...data, selectedBuckets: selected });
  }

  async function handleFetchTableDetails() {
    if (!data.introspection) return;
    setLoadingTables(true);

    // Collect table IDs from selected buckets
    const tableIds: string[] = [];
    for (const bid of data.selectedBuckets) {
      const tables = data.introspection.tablesByBucket[bid] || [];
      for (const t of tables) tableIds.push(t.id);
    }

    onChange({ ...data, selectedTableIds: tableIds });
    setLoadingTables(false);
    onNext();
  }

  const intro = data.introspection;
  const selectedTableCount = data.selectedBuckets.reduce((sum, bid) => {
    return sum + (intro?.tablesByBucket[bid]?.length || 0);
  }, 0);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold">Discover Your Project</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Connect to your Keboola project to discover tables and columns.
        </p>
      </div>

      {/* Model config */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium block mb-1">Model Name</label>
          <input
            value={data.modelName}
            onChange={(e) => onChange({ ...data, modelName: e.target.value })}
            placeholder="e.g. my_project_model"
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">SQL Dialect</label>
          <select
            value={data.sqlDialect}
            onChange={(e) => onChange({ ...data, sqlDialect: e.target.value as "Snowflake" | "BigQuery" })}
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background"
          >
            <option value="Snowflake">Snowflake</option>
            <option value="BigQuery">BigQuery</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">Description</label>
        <textarea
          value={data.modelDescription}
          onChange={(e) => onChange({ ...data, modelDescription: e.target.value })}
          placeholder="What does this semantic model cover?"
          rows={2}
          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Introspect button */}
      {!intro && (
        <button
          onClick={handleIntrospect}
          disabled={loading}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Discovering tables...</>
          ) : (
            <><Search className="h-4 w-4" /> Introspect Project</>
          )}
        </button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Bucket selection */}
      {intro && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              Select Buckets ({data.selectedBuckets.length}/{intro.buckets.length})
            </h4>
            <span className="text-xs text-muted-foreground">
              {selectedTableCount} tables selected
            </span>
          </div>

          <div className="border border-border rounded-lg divide-y divide-border max-h-[300px] overflow-y-auto">
            {intro.buckets.map((b) => {
              const tables = intro.tablesByBucket[b.id] || [];
              const isSelected = data.selectedBuckets.includes(b.id);
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer"
                  onClick={() => toggleBucket(b.id)}
                >
                  {isSelected ? (
                    <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{b.displayName || b.id}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{b.id}</div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {tables.length} tables
                  </span>
                </div>
              );
            })}
          </div>

          {externalLoading === false && error && (
            <p className="text-sm text-destructive mb-2">{error}</p>
          )}

          <button
            onClick={() => { onChange({ ...data, selectedTableIds: [] }); onNext(); }}
            disabled={data.selectedBuckets.length === 0 || externalLoading}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {externalLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Building dataset skeleton...</>
            ) : (
              <>Continue with {selectedTableCount} tables</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

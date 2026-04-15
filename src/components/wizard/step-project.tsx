import { useState, useEffect } from "react";
import { Loader2, CheckSquare, Square } from "lucide-react";

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

  // Auto-introspect on mount
  useEffect(() => {
    if (!data.introspection && !loading) {
      handleIntrospect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const intro = data.introspection;
  const selectedTableCount = data.selectedBuckets.reduce((sum, bid) => {
    return sum + (intro?.tablesByBucket[bid]?.length || 0);
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-12 justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Discovering tables in your project...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-2xl">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={handleIntrospect}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!intro) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold">Select Tables</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Found {intro.totalTables} tables in <strong>{intro.buckets.length}</strong> buckets.
          Select which buckets to include in your semantic model.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">
            Select Buckets ({data.selectedBuckets.length}/{intro.buckets.length})
          </h4>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const allIds = intro.buckets.map((b) => b.id);
                const allSelected = data.selectedBuckets.length === allIds.length;
                onChange({ ...data, selectedBuckets: allSelected ? [] : allIds });
              }}
              className="text-xs text-primary hover:underline"
            >
              {data.selectedBuckets.length === intro.buckets.length ? "Deselect All" : "Select All"}
            </button>
            <span className="text-xs text-muted-foreground">
              {selectedTableCount} tables selected
            </span>
          </div>
        </div>

        <div className="border border-border rounded-lg divide-y divide-border max-h-[400px] overflow-y-auto">
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
    </div>
  );
}

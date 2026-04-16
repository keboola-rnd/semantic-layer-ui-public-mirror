import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  MinusSquare,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Bucket {
  id: string;
  name: string;
  description: string;
  displayName: string;
}

interface TableSummary {
  id: string;
  name: string;
  displayName?: string;
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

/** Highlight matching text within a string */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
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
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReasoning, setAiReasoning] = useState("");

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

      // Select ALL tables by default (derive bucket selection from that)
      const allTableIds: string[] = [];
      for (const tables of Object.values(result.tablesByBucket)) {
        for (const t of tables) allTableIds.push(t.id);
      }

      onChange({
        ...data,
        modelName: data.modelName || autoName,
        sqlDialect: result.sqlDialect as "Snowflake" | "BigQuery",
        introspection: result,
        selectedBuckets: result.buckets.map((b) => b.id),
        selectedTableIds: allTableIds,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Introspection failed");
    } finally {
      setLoading(false);
    }
  }

  const intro = data.introspection;

  // Build flat list of all tables for counting
  const allTableIds = useMemo(() => {
    if (!intro) return [];
    const ids: string[] = [];
    for (const tables of Object.values(intro.tablesByBucket)) {
      for (const t of tables) ids.push(t.id);
    }
    return ids;
  }, [intro]);

  // Selected table IDs set for fast lookup
  const selectedSet = useMemo(() => new Set(data.selectedTableIds), [data.selectedTableIds]);

  // Filter buckets and tables by search query
  const filteredBuckets = useMemo(() => {
    if (!intro) return [];
    const q = search.toLowerCase().trim();
    if (!q) return intro.buckets;

    return intro.buckets.filter((b) => {
      const bucketMatch =
        b.id.toLowerCase().includes(q) ||
        (b.displayName || b.name).toLowerCase().includes(q);
      const tables = intro.tablesByBucket[b.id] || [];
      const hasTableMatch = tables.some(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          (t.displayName || "").toLowerCase().includes(q)
      );
      return bucketMatch || hasTableMatch;
    });
  }, [intro, search]);

  // Auto-expand buckets that have table-level matches when searching
  useEffect(() => {
    if (!intro || !search.trim()) return;
    const q = search.toLowerCase().trim();
    const toExpand = new Set(expanded);
    for (const b of filteredBuckets) {
      const tables = intro.tablesByBucket[b.id] || [];
      const hasTableMatch = tables.some(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          (t.displayName || "").toLowerCase().includes(q)
      );
      if (hasTableMatch) toExpand.add(b.id);
    }
    setExpanded(toExpand);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter tables within a bucket when searching
  function getVisibleTables(bucketId: string): TableSummary[] {
    if (!intro) return [];
    const tables = intro.tablesByBucket[bucketId] || [];
    if (!search.trim()) return tables;
    const q = search.toLowerCase().trim();
    // If the bucket itself matches, show all its tables
    const bucket = intro.buckets.find((b) => b.id === bucketId);
    const bucketMatch =
      bucket &&
      (bucket.id.toLowerCase().includes(q) ||
        (bucket.displayName || bucket.name).toLowerCase().includes(q));
    if (bucketMatch) return tables;
    // Otherwise filter to matching tables only
    return tables.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.displayName || "").toLowerCase().includes(q)
    );
  }

  // Selection helpers
  function toggleTable(tableId: string) {
    const next = selectedSet.has(tableId)
      ? data.selectedTableIds.filter((id) => id !== tableId)
      : [...data.selectedTableIds, tableId];
    onChange({ ...data, selectedTableIds: next });
  }

  function toggleBucket(bucketId: string) {
    const tables = intro?.tablesByBucket[bucketId] || [];
    const tableIds = tables.map((t) => t.id);
    const allSelected = tableIds.every((id) => selectedSet.has(id));

    let next: string[];
    if (allSelected) {
      // Deselect all tables in this bucket
      const removeSet = new Set(tableIds);
      next = data.selectedTableIds.filter((id) => !removeSet.has(id));
    } else {
      // Select all tables in this bucket
      const addSet = new Set(data.selectedTableIds);
      for (const id of tableIds) addSet.add(id);
      next = Array.from(addSet);
    }
    onChange({ ...data, selectedTableIds: next });
  }

  function selectAll() {
    onChange({ ...data, selectedTableIds: [...allTableIds] });
  }

  function deselectAll() {
    onChange({ ...data, selectedTableIds: [] });
  }

  function toggleExpand(bucketId: string) {
    const next = new Set(expanded);
    if (next.has(bucketId)) next.delete(bucketId);
    else next.add(bucketId);
    setExpanded(next);
  }

  // AI-assisted table selection
  async function handleAiSuggest() {
    if (!intro || !aiDescription.trim()) return;
    setAiLoading(true);
    setAiReasoning("");
    try {
      // Build compact bucket/table summary for the AI
      const bucketSummary = intro.buckets.map((b) => ({
        bucketId: b.id,
        displayName: b.displayName || b.name,
        tables: (intro.tablesByBucket[b.id] || []).map((t) => ({
          id: t.id,
          name: t.displayName || t.name,
          rows: t.rowsCount,
        })),
      }));

      const resp = await fetch("/backend/suggest-tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: aiDescription,
          buckets: bucketSummary,
        }),
      });
      if (!resp.ok) throw new Error("AI suggestion failed");
      const result = await resp.json();
      const suggestedIds: string[] = result.tableIds || [];
      if (suggestedIds.length > 0) {
        onChange({ ...data, selectedTableIds: suggestedIds });
        setAiReasoning(result.reasoning || "");
        // Expand buckets that contain selected tables
        const bucketsToExpand = new Set<string>();
        for (const tid of suggestedIds) {
          const bucketId = tid.substring(0, tid.lastIndexOf("."));
          bucketsToExpand.add(bucketId);
        }
        setExpanded(bucketsToExpand);
      }
    } catch (err) {
      console.error("AI table suggestion failed:", err);
    } finally {
      setAiLoading(false);
    }
  }

  // Bucket selection state: all, some, or none
  function bucketState(bucketId: string): "all" | "some" | "none" {
    const tables = intro?.tablesByBucket[bucketId] || [];
    if (tables.length === 0) return "none";
    const selectedCount = tables.filter((t) => selectedSet.has(t.id)).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === tables.length) return "all";
    return "some";
  }

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

  const selectedCount = data.selectedTableIds.length;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h3 className="text-lg font-semibold">Select Tables</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Found {intro.totalTables} tables in{" "}
          <strong>{intro.buckets.length}</strong> buckets. Select which tables
          to include in your semantic model.
        </p>
      </div>

      {/* AI-assisted selection */}
      <div className="border border-purple-200 bg-purple-50/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-purple-800">
          <Sparkles className="h-4 w-4" />
          Let AI help you choose tables
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder='e.g. "customer analytics model" or "sales pipeline with products and orders"'
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && aiDescription.trim()) handleAiSuggest();
            }}
            className="flex-1 px-3 py-1.5 text-sm border border-purple-200 rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <button
            onClick={handleAiSuggest}
            disabled={aiLoading || !aiDescription.trim()}
            className="px-4 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 shrink-0"
          >
            {aiLoading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...</>
            ) : (
              <><Sparkles className="h-3.5 w-3.5" /> Suggest Tables</>
            )}
          </button>
        </div>
        {aiReasoning && (
          <p className="text-xs text-purple-700 bg-purple-100/50 rounded px-3 py-2">
            {aiReasoning}
          </p>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search buckets and tables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={selectAll}
            className="text-xs text-primary hover:underline"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="text-xs text-primary hover:underline"
          >
            Deselect All
          </button>
          <button
            onClick={() =>
              setExpanded(new Set(filteredBuckets.map((b) => b.id)))
            }
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Expand All
          </button>
          <button
            onClick={() => setExpanded(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Collapse All
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          {selectedCount}/{intro.totalTables} tables selected
        </span>
      </div>

      {/* Bucket + table tree */}
      <div className="border border-border rounded-lg max-h-[500px] overflow-y-auto">
        {filteredBuckets.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No buckets or tables match &ldquo;{search}&rdquo;
          </div>
        )}
        {filteredBuckets.map((b) => {
          const tables = intro.tablesByBucket[b.id] || [];
          const visibleTables = getVisibleTables(b.id);
          const state = bucketState(b.id);
          const isExpanded = expanded.has(b.id);
          const selectedInBucket = tables.filter((t) =>
            selectedSet.has(t.id)
          ).length;

          return (
            <div key={b.id} className="border-b border-border last:border-b-0">
              {/* Bucket row */}
              <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30">
                {/* Expand toggle */}
                <button
                  onClick={() => toggleExpand(b.id)}
                  className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {/* Bucket checkbox */}
                <button
                  onClick={() => toggleBucket(b.id)}
                  className="shrink-0"
                >
                  {state === "all" ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : state === "some" ? (
                    <MinusSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {/* Bucket label */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => toggleExpand(b.id)}
                >
                  <div className="text-sm font-medium">
                    <HighlightMatch
                      text={b.displayName || b.id}
                      query={search}
                    />
                  </div>
                  {b.displayName && b.displayName !== b.id && (
                    <div className="text-[10px] text-muted-foreground font-mono">
                      <HighlightMatch text={b.id} query={search} />
                    </div>
                  )}
                </div>

                <span className="text-xs text-muted-foreground shrink-0">
                  {selectedInBucket}/{tables.length}
                </span>
              </div>

              {/* Expanded table list */}
              {isExpanded && (
                <div className="bg-muted/10">
                  {visibleTables.map((t) => {
                    const isSelected = selectedSet.has(t.id);
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          "flex items-center gap-2 pl-12 pr-3 py-1.5 hover:bg-muted/30 cursor-pointer",
                          isSelected && "bg-primary/5"
                        )}
                        onClick={() => toggleTable(t.id)}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm">
                            <HighlightMatch
                              text={t.displayName || t.name}
                              query={search}
                            />
                          </span>
                        </div>
                        {t.rowsCount > 0 && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {t.rowsCount.toLocaleString()} rows
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {visibleTables.length === 0 && (
                    <div className="pl-12 pr-3 py-2 text-xs text-muted-foreground italic">
                      No tables match search
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Continue button */}
      <button
        onClick={() => onNext()}
        disabled={selectedCount === 0 || externalLoading}
        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
      >
        {externalLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Building dataset
            skeleton...
          </>
        ) : (
          <>Continue with {selectedCount} tables</>
        )}
      </button>
    </div>
  );
}

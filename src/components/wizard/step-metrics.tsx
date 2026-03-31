import { useState } from "react";
import { Check, X, Pencil, Plus, Sparkles } from "lucide-react";

interface MetricDraft {
  name: string;
  sql: string;
  dataset: string;
  description: string;
  accepted: boolean;
}

export function StepMetrics({
  metrics: initialMetrics,
  datasetIds,
  onChange,
  onNext,
  onBack,
}: {
  metrics: MetricDraft[];
  datasetIds: string[];
  onChange: (metrics: MetricDraft[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [metrics, setMetrics] = useState<MetricDraft[]>(
    initialMetrics.map((m) => ({ ...m, accepted: m.accepted ?? true }))
  );
  const [editing, setEditing] = useState<number | null>(null);

  function update(index: number, updates: Partial<MetricDraft>) {
    const next = [...metrics];
    next[index] = { ...next[index], ...updates };
    setMetrics(next);
    onChange(next);
  }

  function remove(index: number) {
    const next = metrics.filter((_, i) => i !== index);
    setMetrics(next);
    onChange(next);
  }

  function addMetric() {
    const next = [
      ...metrics,
      { name: "", sql: "", dataset: datasetIds[0] || "", description: "", accepted: true },
    ];
    setMetrics(next);
    setEditing(next.length - 1);
    onChange(next);
  }

  const accepted = metrics.filter((m) => m.accepted);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Review Metrics</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {accepted.length} of {metrics.length} metrics accepted. Edit or add your own.
          </p>
        </div>
        <button
          onClick={addMetric}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <Plus className="h-3 w-3" /> Add Metric
        </button>
      </div>

      <div className="space-y-2">
        {metrics.map((m, i) => (
          <div
            key={i}
            className={`border rounded-lg p-4 transition-all ${
              m.accepted ? "border-border" : "border-border/50 opacity-50"
            }`}
          >
            {editing === i ? (
              /* Edit mode */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium block mb-0.5">Name</label>
                    <input
                      value={m.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium block mb-0.5">Dataset</label>
                    <select
                      value={m.dataset}
                      onChange={(e) => update(i, { dataset: e.target.value })}
                      className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
                    >
                      <option value="">Select dataset</option>
                      {datasetIds.map((id) => (
                        <option key={id} value={id}>{id.split(".").pop()}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-medium block mb-0.5">SQL Expression</label>
                  <textarea
                    value={m.sql}
                    onChange={(e) => update(i, { sql: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-input rounded bg-background font-mono"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium block mb-0.5">Description</label>
                  <input
                    value={m.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-input rounded bg-background"
                  />
                </div>
                <button
                  onClick={() => setEditing(null)}
                  className="text-xs text-primary hover:underline"
                >
                  Done editing
                </button>
              </div>
            ) : (
              /* View mode */
              <div className="flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{m.name || "Unnamed"}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {m.dataset ? m.dataset.split(".").pop() : "-"}
                    </span>
                  </div>
                  <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground block mt-1">
                    {m.sql}
                  </code>
                  {m.description && (
                    <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setEditing(i)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => update(i, { accepted: !m.accepted })}
                    className={`p-1 ${m.accepted ? "text-green-600" : "text-muted-foreground"}`}
                    title={m.accepted ? "Accepted" : "Rejected"}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove(i)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent">
          Back
        </button>
        <button onClick={onNext} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
          Continue to Enrichment
        </button>
      </div>
    </div>
  );
}

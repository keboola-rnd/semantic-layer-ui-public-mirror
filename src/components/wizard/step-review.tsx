import { useState, useEffect } from "react";
import { Loader2, Check, Database, BarChart3, GitBranch, BookOpen, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useModel } from "@/providers/model-context";

interface CreateResult {
  modelUUID: string;
  modelName: string;
  created: { datasets: number; metrics: number; relationships: number; glossary: number };
  errors: Array<{ type: string; name: string; error: string }>;
}

export function StepReview({
  model,
  datasets,
  metrics,
  relationships,
  glossary,
  constraints,
  onModelChange,
  onBack,
}: {
  model: { name: string; description: string; sql_dialect: string };
  datasets: Array<Record<string, unknown>>;
  metrics: Array<Record<string, unknown>>;
  relationships: Array<Record<string, unknown>>;
  glossary: Array<Record<string, unknown>>;
  constraints?: Array<Record<string, unknown>>;
  onModelChange?: (updates: { modelName?: string; modelDescription?: string }) => void;
  onBack: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState("");
  const [editingModel, setEditingModel] = useState(false);
  const [localName, setLocalName] = useState(model.name);
  const [localDesc, setLocalDesc] = useState(model.description);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Auto-generate description if empty
  useEffect(() => {
    if (!model.description && datasets.length > 0 && !generatingDesc) {
      setGeneratingDesc(true);
      fetch("/backend/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelName: model.name,
          datasets: datasets.map((d: Record<string, unknown>) => ({ name: d.name, tableId: d.tableId })),
          metrics: metrics.map((m: Record<string, unknown>) => ({ name: m.name })),
        }),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.description) {
            setLocalDesc(data.description);
            onModelChange?.({ modelDescription: data.description });
          }
        })
        .catch(() => {})
        .finally(() => setGeneratingDesc(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setModelUUID } = useModel();

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const resp = await fetch("/backend/create-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: { ...model, name: localName, description: localDesc },
          datasets, metrics, relationships, glossary, constraints,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Creation failed");
      }
      const res: CreateResult = await resp.json();
      setResult(res);
      // Invalidate cache so the new model appears
      queryClient.invalidateQueries({ queryKey: ["models"] });
      queryClient.invalidateQueries({ queryKey: ["model-objects"] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setCreating(false);
    }
  }

  if (result) {
    const hasErrors = result.errors.length > 0;
    const totalCreated = result.created.datasets + result.created.metrics + result.created.relationships + result.created.glossary + ((result.created as Record<string, number>).constraints || 0);
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-6">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${hasErrors ? "bg-amber-100" : "bg-green-100"}`}>
          <Check className={`h-8 w-8 ${hasErrors ? "text-amber-600" : "text-green-600"}`} />
        </div>
        <div>
          <h3 className="text-xl font-semibold">{hasErrors ? "Model Created with Warnings" : "Model Created!"}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            <strong>{result.modelName}</strong> — {totalCreated} objects created{hasErrors ? `, ${result.errors.length} failed` : ""}.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="border rounded-lg p-3"><Database className="h-4 w-4 inline mr-1.5 text-blue-500" />{result.created.datasets} datasets</div>
          <div className="border rounded-lg p-3"><BarChart3 className="h-4 w-4 inline mr-1.5 text-green-500" />{result.created.metrics} metrics</div>
          <div className="border rounded-lg p-3"><GitBranch className="h-4 w-4 inline mr-1.5 text-purple-500" />{result.created.relationships} relationships</div>
          <div className="border rounded-lg p-3"><BookOpen className="h-4 w-4 inline mr-1.5 text-orange-500" />{result.created.glossary} glossary terms</div>
          {(result.created as Record<string, number>).constraints > 0 && (
            <div className="border rounded-lg p-3 col-span-2"><ShieldCheck className="h-4 w-4 inline mr-1.5 text-red-500" />{(result.created as Record<string, number>).constraints} constraints</div>
          )}
        </div>
        {result.errors.length > 0 && (
          <div className="text-left border border-destructive/30 rounded-lg p-3">
            <p className="text-xs font-medium text-destructive mb-1">{result.errors.length} errors:</p>
            {result.errors.slice(0, 5).map((e, i) => (
              <p key={i} className="text-[10px] text-muted-foreground">{e.type}/{e.name}: {e.error.substring(0, 100)}</p>
            ))}
          </div>
        )}
        <div className="flex gap-3 justify-center">
        <button
          onClick={() => navigate("/")}
          className="px-6 py-2 text-sm border border-border rounded-md hover:bg-accent"
        >
          Go to Dashboard
        </button>
        <button
          onClick={() => {
            setModelUUID(result.modelUUID);
            navigate("/");
          }}
          className="px-6 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          View Model
        </button>
        </div>
      </div>
    );
  }

  const stats = [
    { icon: Database, label: "Datasets", count: datasets.length, color: "text-blue-500" },
    { icon: BarChart3, label: "Metrics", count: metrics.length, color: "text-green-500" },
    { icon: GitBranch, label: "Relationships", count: relationships.length, color: "text-purple-500" },
    { icon: BookOpen, label: "Glossary", count: glossary.length, color: "text-orange-500" },
    { icon: ShieldCheck, label: "Constraints", count: (constraints || []).length, color: "text-red-500" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold">Review & Create</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Review the semantic model before creating it in the metastore.
        </p>
      </div>

      {/* Model info (editable) */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        {editingModel ? (
          <>
            <div>
              <label className="text-xs font-medium block mb-1">Model Name</label>
              <input
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-input rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Description</label>
              <textarea
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                rows={3}
                className="w-full px-3 py-1.5 text-sm border border-input rounded-md bg-background"
              />
            </div>
            <button
              onClick={() => {
                onModelChange?.({ modelName: localName, modelDescription: localDesc });
                setEditingModel(false);
              }}
              className="text-xs text-primary hover:underline"
            >
              Done editing
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{localName}</h4>
              <button onClick={() => setEditingModel(true)} className="text-xs text-muted-foreground hover:text-foreground">
                Edit
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              {generatingDesc ? "Generating description..." : (localDesc || "No description")}
            </p>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{model.sql_dialect}</span>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="border border-border rounded-lg p-3 text-center">
            <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
            <div className="text-xl font-semibold">{s.count}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="border border-destructive/50 bg-destructive/5 rounded-lg p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          disabled={creating}
          className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
        >
          Back
        </button>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="px-6 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          {creating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Creating model...</>
          ) : (
            <>Create Model ({datasets.length + metrics.length + relationships.length + glossary.length} objects)</>
          )}
        </button>
      </div>
    </div>
  );
}

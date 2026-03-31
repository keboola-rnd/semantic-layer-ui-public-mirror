import { useState } from "react";
import { Loader2, Check, Database, BarChart3, GitBranch, BookOpen, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

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
  onBack,
}: {
  model: { name: string; description: string; sql_dialect: string };
  datasets: Array<Record<string, unknown>>;
  metrics: Array<Record<string, unknown>>;
  relationships: Array<Record<string, unknown>>;
  glossary: Array<Record<string, unknown>>;
  constraints?: Array<Record<string, unknown>>;
  onBack: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleCreate() {
    setCreating(true);
    setError("");
    try {
      const resp = await fetch("/backend/create-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, datasets, metrics, relationships, glossary, constraints }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Creation failed");
      }
      const res: CreateResult = await resp.json();
      setResult(res);
      // Invalidate cache so the new model appears
      queryClient.invalidateQueries({ queryKey: ["all-objects"] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setCreating(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 space-y-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Model Created!</h3>
          <p className="text-sm text-muted-foreground mt-1">
            <strong>{result.modelName}</strong> has been created with:
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
            // Select the newly created model and go to dashboard
            localStorage.setItem("selected-model-uuid", result.modelUUID);
            navigate("/");
            window.location.reload();
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

      {/* Model info */}
      <div className="border border-border rounded-lg p-4 space-y-2">
        <h4 className="font-medium">{model.name}</h4>
        <p className="text-sm text-muted-foreground">{model.description || "No description"}</p>
        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{model.sql_dialect}</span>
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

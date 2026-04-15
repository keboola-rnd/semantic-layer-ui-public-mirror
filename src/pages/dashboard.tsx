import { useState } from "react";
import { useModels, useModelDetail } from "@/hooks/use-models";
import { useModel } from "@/providers/model-context";
import { deleteObject } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Database, BarChart3, GitBranch, BookOpen, ShieldCheck, Trash2, PlusCircle } from "lucide-react";
import { Link, useNavigate } from "react-router";

function DeleteModelDialog({
  modelName,
  modelUUID,
  onClose,
}: {
  modelName: string;
  modelUUID: string;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const { modelUUID: selectedUUID, setModelUUID } = useModel();

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      await deleteObject("semantic-model", modelUUID);
      if (selectedUUID === modelUUID) setModelUUID("");
      queryClient.invalidateQueries({ queryKey: ["models"] });
      queryClient.invalidateQueries({ queryKey: ["model-objects"] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="text-lg font-semibold text-destructive">Delete Model</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This will permanently delete <strong>{modelName}</strong> and cannot be undone.
            Type the model name to confirm.
          </p>
        </div>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={modelName}
          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-destructive"
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={typed !== modelName || deleting}
            className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete Model"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModelStats({ modelUUID }: { modelUUID: string }) {
  const { data: model, isLoading } = useModelDetail(modelUUID);

  const stats = [
    { label: "Datasets", count: model?.datasetCount ?? 0, icon: Database, path: "/datasets", color: "text-blue-600" },
    { label: "Metrics", count: model?.metricCount ?? 0, icon: BarChart3, path: "/metrics", color: "text-green-600" },
    { label: "Relationships", count: model?.relationshipCount ?? 0, icon: GitBranch, path: "/relationships", color: "text-purple-600" },
    { label: "Glossary Terms", count: model?.glossaryCount ?? 0, icon: BookOpen, path: "/glossary", color: "text-orange-600" },
    { label: "Constraints", count: model?.constraintCount ?? 0, icon: ShieldCheck, path: "/constraints", color: "text-red-600" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {stats.map((s) => (
        <Link
          key={s.label}
          to={s.path}
          className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <s.icon className={`h-4 w-4 ${s.color}`} />
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
          <div className="text-2xl font-semibold">
            {isLoading ? <span className="text-muted-foreground animate-pulse">...</span> : s.count}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { modelUUID, setModelUUID } = useModel();
  const { data: models, isLoading, error } = useModels();
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; uuid: string } | null>(null);
  const navigate = useNavigate();

  const model = models?.find((m) => m.id === modelUUID);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-destructive/50 bg-destructive/5 rounded-lg p-6 space-y-2">
        <h3 className="font-semibold text-destructive">Failed to load models</h3>
        <p className="text-sm text-muted-foreground">{String(error)}</p>
        <p className="text-xs text-muted-foreground">
          Check that the KBC_TOKEN has access to the metastore for the correct project.
        </p>
      </div>
    );
  }

  if (!model && models && models.length > 0) {
    setModelUUID(models[0].id);
  }

  if (!model) {
    if (models?.length) {
      return (
        <div className="text-center py-20 text-muted-foreground">
          <p>Loading model...</p>
        </div>
      );
    }
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-6">
        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
          <Database className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Build Your Semantic Layer</h2>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Define how your data should be understood — datasets, metrics, relationships, and business terms — so AI agents can write accurate SQL.
          </p>
        </div>
        <button
          onClick={() => navigate("/create-model")}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Create Your First Model
        </button>
        <p className="text-xs text-muted-foreground">
          The wizard will scan your Keboola project and use AI to classify your tables, suggest metrics, and build a complete semantic model.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{model.attributes.name}</h2>
        {model.attributes.description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {model.attributes.description}
          </p>
        )}
      </div>

      <ModelStats modelUUID={model.id} />

      <div className="border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-2">All Models</h3>
        <div className="space-y-2">
          {models?.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between text-sm py-1.5 group"
            >
              <button
                onClick={() => setModelUUID(m.id)}
                className="flex-1 text-left hover:underline"
              >
                <span className="font-medium">{m.attributes.name}</span>
                <span className="ml-2 text-xs text-muted-foreground font-mono">
                  {m.attributes.sql_dialect}
                </span>
                {m.id === modelUUID && (
                  <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">selected</span>
                )}
              </button>
              <button
                onClick={() => setDeleteTarget({ name: m.attributes.name, uuid: m.id })}
                className="p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete model"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {deleteTarget && (
        <DeleteModelDialog
          modelName={deleteTarget.name}
          modelUUID={deleteTarget.uuid}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

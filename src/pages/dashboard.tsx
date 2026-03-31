import { useModelSummaries } from "@/hooks/use-models";
import { useModel } from "@/providers/model-context";
import { Database, BarChart3, GitBranch, BookOpen, ShieldCheck } from "lucide-react";
import { Link } from "react-router";

export function DashboardPage() {
  const { modelUUID, setModelUUID } = useModel();
  const { data: models, isLoading, error } = useModelSummaries();
  const model = models?.find((m) => m.uuid === modelUUID);

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
          The token from the data app's project may not match the project where the semantic layer is stored (project 4451).
        </p>
        <button
          onClick={() => window.open("/health", "_blank")}
          className="text-xs underline text-muted-foreground"
        >
          Check server health/debug info
        </button>
      </div>
    );
  }

  if (!model && models && models.length > 0) {
    // Auto-select first model if none matches
    setModelUUID(models[0].uuid);
  }

  if (!model) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>{models?.length ? "Loading model..." : "No models found. Create one to get started."}</p>
      </div>
    );
  }

  const stats = [
    { label: "Datasets", count: model.datasetCount, icon: Database, path: "/datasets", color: "text-blue-600" },
    { label: "Metrics", count: model.metricCount, icon: BarChart3, path: "/metrics", color: "text-green-600" },
    { label: "Relationships", count: model.relationshipCount, icon: GitBranch, path: "/relationships", color: "text-purple-600" },
    { label: "Glossary Terms", count: model.glossaryCount, icon: BookOpen, path: "/glossary", color: "text-orange-600" },
    { label: "Constraints", count: model.constraintCount, icon: ShieldCheck, path: "/constraints", color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{model.name}</h2>
        {model.description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {model.description}
          </p>
        )}
      </div>

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
            <div className="text-2xl font-semibold">{s.count}</div>
          </Link>
        ))}
      </div>

      <div className="border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium mb-2">All Models</h3>
        <div className="space-y-2">
          {models?.map((m) => (
            <div
              key={m.uuid}
              className="flex items-center justify-between text-sm py-1"
            >
              <div>
                <span className="font-medium">{m.name}</span>
                <span className="ml-2 text-xs text-muted-foreground font-mono">
                  {m.sql_dialect}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {m.datasetCount}ds / {m.metricCount}met / {m.relationshipCount}rel / {m.glossaryCount}gl
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useParams, Link } from "react-router";
import { useMetric, useUpdateMetric } from "@/hooks/use-metrics";
import { ArrowLeft, Save, Pencil } from "lucide-react";
import { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { ObjectMetaPanel } from "@/components/shared/object-meta";
import { sql } from "@codemirror/lang-sql";

export function MetricDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const { data: metric, isLoading } = useMetric(uuid || "");
  const updateMetric = useUpdateMetric();
  const [editing, setEditing] = useState(false);
  const [editSql, setEditSql] = useState("");
  const [editDesc, setEditDesc] = useState("");

  if (isLoading || !metric) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  const m = metric.attributes;

  function startEdit() {
    setEditSql(m.sql);
    setEditDesc(m.description || "");
    setEditing(true);
  }

  function handleSave() {
    if (!uuid) return;
    updateMetric.mutate(
      { uuid, data: { sql: editSql, description: editDesc } },
      { onSuccess: () => setEditing(false) }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link
          to="/metrics"
          className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{m.name}</h2>
            {!editing && (
              <button
                onClick={startEdit}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {m.dataset && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Dataset:{" "}
              <span className="font-mono">{m.dataset}</span>
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-1">Description</h3>
        {editing ? (
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            className="w-full text-sm border border-input rounded-md p-3 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            rows={3}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {m.description || "No description"}
          </p>
        )}
      </div>

      {/* SQL */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-1">SQL Expression</h3>
        {editing ? (
          <div className="border border-input rounded-md overflow-hidden">
            <CodeMirror
              value={editSql}
              onChange={setEditSql}
              extensions={[sql()]}
              height="200px"
              theme="light"
            />
          </div>
        ) : (
          <div className="bg-muted rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm font-mono whitespace-pre-wrap">{m.sql}</pre>
          </div>
        )}
      </div>

      {editing && (
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={updateMetric.isPending}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2"
          >
            <Save className="h-3.5 w-3.5" />
            {updateMetric.isPending ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Metadata */}
      <ObjectMetaPanel meta={metric.meta} uuid={metric.id} />
    </div>
  );
}

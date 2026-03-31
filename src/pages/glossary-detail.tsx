import { useParams, Link } from "react-router";
import { useGlossaryTerm, useUpdateGlossaryTerm } from "@/hooks/use-glossary";
import { ArrowLeft, Save, Pencil } from "lucide-react";
import { useState } from "react";

export function GlossaryDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const { data: term, isLoading } = useGlossaryTerm(uuid || "");
  const updateTerm = useUpdateGlossaryTerm();
  const [editing, setEditing] = useState(false);
  const [editDef, setEditDef] = useState("");

  if (isLoading || !term) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  const g = term.attributes;

  function startEdit() {
    setEditDef(g.definition);
    setEditing(true);
  }

  function handleSave() {
    if (!uuid) return;
    updateTerm.mutate(
      { uuid, data: { definition: editDef } },
      { onSuccess: () => setEditing(false) }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link
          to="/glossary"
          className="mt-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{g.term}</h2>
            {!editing && (
              <button onClick={startEdit} className="text-muted-foreground hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-1">Definition</h3>
        {editing ? (
          <textarea
            value={editDef}
            onChange={(e) => setEditDef(e.target.value)}
            className="w-full text-sm border border-input rounded-md p-3 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            rows={8}
          />
        ) : (
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm whitespace-pre-wrap">{g.definition}</p>
          </div>
        )}
      </div>

      {editing && (
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={updateTerm.isPending}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2"
          >
            <Save className="h-3.5 w-3.5" />
            {updateTerm.isPending ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent"
          >
            Cancel
          </button>
        </div>
      )}

      {g.seeAlso && g.seeAlso.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Related Datasets</h3>
          <div className="flex flex-wrap gap-2">
            {g.seeAlso.map((ref) => (
              <span
                key={ref}
                className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-mono"
              >
                {ref}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-border pt-4 text-xs text-muted-foreground">
        <div className="flex gap-6">
          <span>UUID: <code className="bg-muted px-1 rounded">{term.id}</code></span>
          <span>Revision: {term.meta.revision}</span>
          <span>Updated: {new Date(term.meta.lastUpdated).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

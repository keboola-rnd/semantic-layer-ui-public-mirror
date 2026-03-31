import { useParams, Link } from "react-router";
import { useDataset, useUpdateDataset } from "@/hooks/use-datasets";
import { useRelationships } from "@/hooks/use-relationships";
import { useModel } from "@/providers/model-context";
import { cn } from "@/lib/utils";
import { ROLE_COLORS, TYPE_COLORS } from "@/lib/constants";
import { ArrowLeft, Save, Check, X } from "lucide-react";
import { useState, useCallback } from "react";
import { ObjectMetaPanel } from "@/components/shared/object-meta";

function InlineEdit({
  value,
  onSave,
  placeholder = "Click to edit...",
}: {
  value: string;
  onSave: (val: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 min-w-[60px] inline-block"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value || <span className="text-muted-foreground/50 italic">{placeholder}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(draft);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        className="text-xs border border-input rounded px-1.5 py-0.5 bg-background focus:outline-none focus:ring-1 focus:ring-ring w-full max-w-[300px]"
      />
      <button
        onClick={() => { onSave(draft); setEditing(false); }}
        className="text-green-600 hover:text-green-700"
      >
        <Check className="h-3 w-3" />
      </button>
      <button
        onClick={() => setEditing(false)}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function DatasetDetailPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const { data: dataset, isLoading } = useDataset(uuid || "");
  const { modelUUID } = useModel();
  const { data: relationships } = useRelationships(modelUUID);
  const updateDataset = useUpdateDataset();
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [activeTab, setActiveTab] = useState<"fields" | "ai" | "relationships" | "metadata">("fields");

  const handleFieldDescriptionSave = useCallback(
    (fieldName: string, newDesc: string) => {
      if (!uuid || !dataset) return;
      const fields = (dataset.attributes.fields || []).map((f) =>
        f.name === fieldName ? { ...f, description: newDesc } : f
      );
      updateDataset.mutate({ uuid, data: { fields } });
    },
    [uuid, dataset, updateDataset]
  );

  if (isLoading || !dataset) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  const d = dataset.attributes;
  const fields = d.fields || [];
  const ai = d.ai || {};
  const relatedRels = relationships?.filter(
    (r) => r.attributes.from === d.tableId || r.attributes.to === d.tableId
  );

  function handleSaveDescription() {
    if (!uuid) return;
    updateDataset.mutate(
      { uuid, data: { description } },
      { onSuccess: () => setEditingDescription(false) }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link to="/datasets" className="mt-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold">{d.name}</h2>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">{d.tableId}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span>FQN: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{d.fqn}</code></span>
            {d.grain && <span>Grain: {d.grain}</span>}
            {d.primaryKey && d.primaryKey.length > 0 && (
              <span>PK: {d.primaryKey.join(", ")}</span>
            )}
          </div>

          <div className="mt-3">
            {editingDescription ? (
              <div className="flex gap-2">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="flex-1 text-sm border border-input rounded-md p-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={2}
                />
                <button
                  onClick={handleSaveDescription}
                  disabled={updateDataset.isPending}
                  className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1 self-start"
                >
                  <Save className="h-3 w-3" /> Save
                </button>
              </div>
            ) : (
              <p
                className="text-sm text-muted-foreground cursor-pointer hover:text-foreground hover:bg-muted/50 rounded px-1 -mx-1"
                onClick={() => { setDescription(d.description || ""); setEditingDescription(true); }}
              >
                {d.description || "Click to add description..."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["fields", "ai", "relationships", "metadata"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm capitalize border-b-2 transition-colors -mb-px",
              activeTab === tab
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "ai" ? "AI Hints" : tab}
            {tab === "fields" && ` (${fields.length})`}
            {tab === "relationships" && ` (${relatedRels?.length || 0})`}
          </button>
        ))}
      </div>

      {/* Fields Tab */}
      {activeTab === "fields" && (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-3 py-2 font-medium w-[200px]">Field</th>
                <th className="text-left px-3 py-2 font-medium w-[80px]">Role</th>
                <th className="text-left px-3 py-2 font-medium w-[80px]">Type</th>
                <th className="text-left px-3 py-2 font-medium">Description <span className="font-normal text-muted-foreground">(click to edit)</span></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.name} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs font-medium">{f.name}</td>
                  <td className="px-3 py-2">
                    {f.role && (
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", ROLE_COLORS[f.role])}>
                        {f.role}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {f.type && (
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded", TYPE_COLORS[f.type] || "bg-gray-100")}>
                        {f.type}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    <InlineEdit
                      value={f.description || ""}
                      onSave={(val) => handleFieldDescriptionSave(f.name, val)}
                      placeholder="Add description..."
                    />
                  </td>
                </tr>
              ))}
              {fields.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                    No fields defined
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Hints Tab */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          {ai.keywords && ai.keywords.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Keywords</h4>
              <div className="flex flex-wrap gap-1.5">
                {ai.keywords.map((k) => (
                  <span key={k} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{k}</span>
                ))}
              </div>
            </div>
          )}
          {ai.synonyms && ai.synonyms.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Synonyms</h4>
              <div className="flex flex-wrap gap-1.5">
                {ai.synonyms.map((s) => (
                  <span key={s} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>
            </div>
          )}
          {ai.hints && ai.hints.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Hints</h4>
              <ul className="space-y-1">
                {ai.hints.map((h, i) => (
                  <li key={i} className="text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded">{h}</li>
                ))}
              </ul>
            </div>
          )}
          {ai.warnings && ai.warnings.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1.5">Warnings</h4>
              <ul className="space-y-1">
                {ai.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded">{w}</li>
                ))}
              </ul>
            </div>
          )}
          {!ai.keywords?.length && !ai.synonyms?.length && !ai.hints?.length && !ai.warnings?.length && (
            <p className="text-sm text-muted-foreground py-8 text-center">No AI hints configured</p>
          )}
        </div>
      )}

      {/* Relationships Tab */}
      {activeTab === "relationships" && (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium w-[60px]">Type</th>
                <th className="text-left px-3 py-2 font-medium">From</th>
                <th className="text-left px-3 py-2 font-medium">To</th>
                <th className="text-left px-3 py-2 font-medium">ON</th>
              </tr>
            </thead>
            <tbody>
              {relatedRels?.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{r.attributes.name || "-"}</td>
                  <td className="px-3 py-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      {r.attributes.type || "left"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.attributes.from === d.tableId
                      ? <span className="font-semibold">{r.attributes.from}</span>
                      : r.attributes.from}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.attributes.to === d.tableId
                      ? <span className="font-semibold">{r.attributes.to}</span>
                      : r.attributes.to}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {r.attributes.on}
                  </td>
                </tr>
              ))}
              {(!relatedRels || relatedRels.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No relationships found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Metadata Tab */}
      {activeTab === "metadata" && (
        <ObjectMetaPanel meta={dataset.meta} uuid={dataset.id} />
      )}
    </div>
  );
}

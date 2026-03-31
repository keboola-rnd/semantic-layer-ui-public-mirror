import { useState } from "react";
import { Check, X, Pencil, Plus, GitBranch, CheckCheck } from "lucide-react";

interface RelDraft {
  name: string;
  from: string;
  to: string;
  on: string;
  type: string;
  accepted: boolean;
}

export function StepRelationships({
  relationships: initial,
  datasetIds,
  onChange,
  onNext,
  onBack,
}: {
  relationships: RelDraft[];
  datasetIds: string[];
  onChange: (r: RelDraft[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [rels, setRels] = useState<RelDraft[]>(initial);
  const [editing, setEditing] = useState<number | null>(null);

  function updateAll(next: RelDraft[]) { setRels(next); onChange(next); }
  function update(i: number, u: Partial<RelDraft>) { const n = [...rels]; n[i] = { ...n[i], ...u }; updateAll(n); }
  function remove(i: number) { updateAll(rels.filter((_, j) => j !== i)); }
  function acceptAll() { updateAll(rels.map((r) => ({ ...r, accepted: true }))); }

  function addRel() {
    const n = [...rels, { name: "", from: datasetIds[0] || "", to: datasetIds[1] || "", on: "", type: "left", accepted: true }];
    setRels(n); setEditing(n.length - 1); onChange(n);
  }

  const acceptedCount = rels.filter((r) => r.accepted).length;
  const pendingCount = rels.length - acceptedCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Review Relationships</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {acceptedCount}/{rels.length} accepted. {pendingCount > 0 && `${pendingCount} pending.`} These define how datasets join together.
          </p>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <button onClick={acceptAll} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-green-300 text-green-700 rounded-md hover:bg-green-50">
              <CheckCheck className="h-3 w-3" /> Accept All
            </button>
          )}
          <button onClick={addRel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            <Plus className="h-3 w-3" /> Add Relationship
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {rels.map((r, i) => (
          <div key={i} className={`border rounded-lg p-4 ${r.accepted ? "border-green-200 bg-green-50/30" : "border-border"}`}>
            {editing === i ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-medium block mb-0.5">Name</label>
                    <input value={r.name} onChange={(e) => update(i, { name: e.target.value })} className="w-full px-2 py-1 text-sm border border-input rounded bg-background" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium block mb-0.5">From</label>
                    <select value={r.from} onChange={(e) => update(i, { from: e.target.value })} className="w-full px-2 py-1 text-sm border border-input rounded bg-background">
                      {datasetIds.map((id) => <option key={id} value={id}>{id.split(".").pop()}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium block mb-0.5">To</label>
                    <select value={r.to} onChange={(e) => update(i, { to: e.target.value })} className="w-full px-2 py-1 text-sm border border-input rounded bg-background">
                      {datasetIds.map((id) => <option key={id} value={id}>{id.split(".").pop()}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium block mb-0.5">ON clause</label>
                    <input value={r.on} onChange={(e) => update(i, { on: e.target.value })} className="w-full px-2 py-1 text-sm border border-input rounded bg-background font-mono" placeholder='from."id" = to."id"' />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium block mb-0.5">Join Type</label>
                    <select value={r.type} onChange={(e) => update(i, { type: e.target.value })} className="w-full px-2 py-1 text-sm border border-input rounded bg-background">
                      <option value="left">LEFT</option>
                      <option value="inner">INNER</option>
                    </select>
                  </div>
                </div>
                <button onClick={() => setEditing(null)} className="text-xs text-primary hover:underline">Done editing</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <GitBranch className="h-4 w-4 text-purple-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{r.name || "unnamed"}</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">{r.type}</span>
                    {r.accepted && <span className="text-[10px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded">accepted</span>}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {r.from.split(".").pop()} → {r.to.split(".").pop()} ON {r.on}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditing(i)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => update(i, { accepted: !r.accepted })} className={`p-1.5 border rounded ${r.accepted ? "text-green-600 border-green-300 bg-green-50" : "text-muted-foreground border-border"}`}>
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(i)} className="p-1 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {rels.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
            No relationships suggested. Add one manually or continue.
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent">Back</button>
        <button onClick={onNext} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">Continue to Glossary</button>
      </div>
    </div>
  );
}

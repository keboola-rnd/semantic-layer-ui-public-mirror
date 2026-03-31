import { useState } from "react";
import { Check, X, Pencil, Plus, BookOpen, CheckCheck } from "lucide-react";

interface GlossaryDraft {
  term: string;
  definition: string;
  seeAlso: string[];
  accepted: boolean;
}

export function StepGlossaryReview({
  glossary: initial,
  datasetIds,
  onChange,
  onNext,
  onBack,
}: {
  glossary: GlossaryDraft[];
  datasetIds: string[];
  onChange: (g: GlossaryDraft[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [terms, setTerms] = useState<GlossaryDraft[]>(initial);
  const [editing, setEditing] = useState<number | null>(null);

  function updateAll(next: GlossaryDraft[]) { setTerms(next); onChange(next); }
  function update(i: number, u: Partial<GlossaryDraft>) { const n = [...terms]; n[i] = { ...n[i], ...u }; updateAll(n); }
  function remove(i: number) { updateAll(terms.filter((_, j) => j !== i)); }
  function acceptAll() { updateAll(terms.map((t) => ({ ...t, accepted: true }))); }

  function addTerm() {
    const n = [...terms, { term: "", definition: "", seeAlso: [], accepted: true }];
    setTerms(n); setEditing(n.length - 1); onChange(n);
  }

  const acceptedCount = terms.filter((t) => t.accepted).length;
  const pendingCount = terms.length - acceptedCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Review Glossary</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {acceptedCount}/{terms.length} accepted. Business terms help AI understand your data.
          </p>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <button onClick={acceptAll} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-green-300 text-green-700 rounded-md hover:bg-green-50">
              <CheckCheck className="h-3 w-3" /> Accept All
            </button>
          )}
          <button onClick={addTerm} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            <Plus className="h-3 w-3" /> Add Term
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {terms.map((t, i) => (
          <div key={i} className={`border rounded-lg p-4 ${t.accepted ? "border-green-200 bg-green-50/30" : "border-border"}`}>
            {editing === i ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-medium block mb-0.5">Term</label>
                  <input value={t.term} onChange={(e) => update(i, { term: e.target.value })} className="w-full px-2 py-1 text-sm border border-input rounded bg-background" />
                </div>
                <div>
                  <label className="text-[10px] font-medium block mb-0.5">Definition</label>
                  <textarea value={t.definition} onChange={(e) => update(i, { definition: e.target.value })} rows={3} className="w-full px-2 py-1 text-sm border border-input rounded bg-background" />
                </div>
                <div>
                  <label className="text-[10px] font-medium block mb-0.5">Related Datasets</label>
                  <select multiple value={t.seeAlso} onChange={(e) => update(i, { seeAlso: Array.from(e.target.selectedOptions, (o) => o.value) })} className="w-full px-2 py-1 text-sm border border-input rounded bg-background h-20">
                    {datasetIds.map((id) => <option key={id} value={id}>{id.split(".").pop()}</option>)}
                  </select>
                </div>
                <button onClick={() => setEditing(null)} className="text-xs text-primary hover:underline">Done editing</button>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <BookOpen className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.term || "Unnamed"}</span>
                    {t.accepted && <span className="text-[10px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded">accepted</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.definition.substring(0, 150)}{t.definition.length > 150 ? "..." : ""}</p>
                  {t.seeAlso.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {t.seeAlso.map((s) => (
                        <span key={s} className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{s.split(".").pop()}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditing(i)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => update(i, { accepted: !t.accepted })} className={`p-1.5 border rounded ${t.accepted ? "text-green-600 border-green-300 bg-green-50" : "text-muted-foreground border-border"}`}>
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(i)} className="p-1 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {terms.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
            No glossary terms suggested. Add one manually or continue.
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent">Back</button>
        <button onClick={onNext} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">Continue to Constraints</button>
      </div>
    </div>
  );
}

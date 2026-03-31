import { useState } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";

interface ConstraintDraft {
  name: string;
  constraintType: string;
  rule: string;
  metrics: string[];
  description: string;
  severity: string;
}

export function StepConstraints({
  constraints: initial,
  metricNames,
  onChange,
  onNext,
  onBack,
}: {
  constraints: ConstraintDraft[];
  metricNames: string[];
  onChange: (c: ConstraintDraft[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [items, setItems] = useState<ConstraintDraft[]>(initial);

  function updateAll(next: ConstraintDraft[]) { setItems(next); onChange(next); }
  function update(i: number, u: Partial<ConstraintDraft>) { const n = [...items]; n[i] = { ...n[i], ...u }; updateAll(n); }
  function remove(i: number) { updateAll(items.filter((_, j) => j !== i)); }

  function addConstraint() {
    updateAll([...items, {
      name: "",
      constraintType: "inequality",
      rule: "",
      metrics: [],
      description: "",
      severity: "warning",
    }]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Constraints</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Define business rules that validate relationships between metrics. This step is optional.
          </p>
        </div>
        <button onClick={addConstraint} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
          <Plus className="h-3 w-3" /> Add Constraint
        </button>
      </div>

      <div className="space-y-3">
        {items.map((c, i) => (
          <div key={i} className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <ShieldCheck className="h-4 w-4 text-red-500" />
              <button onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-medium block mb-0.5">Name (snake_case)</label>
                <input value={c.name} onChange={(e) => update(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="revenue_positive" className="w-full px-2 py-1 text-sm border border-input rounded bg-background font-mono" />
              </div>
              <div>
                <label className="text-[10px] font-medium block mb-0.5">Type</label>
                <select value={c.constraintType} onChange={(e) => update(i, { constraintType: e.target.value })} className="w-full px-2 py-1 text-sm border border-input rounded bg-background">
                  {["inequality", "equality", "range", "composition", "exclusion", "temporal", "conditional"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium block mb-0.5">Severity</label>
                <select value={c.severity} onChange={(e) => update(i, { severity: e.target.value })} className="w-full px-2 py-1 text-sm border border-input rounded bg-background">
                  <option value="error">Error</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-medium block mb-0.5">Rule</label>
              <input value={c.rule} onChange={(e) => update(i, { rule: e.target.value })} placeholder="revenue >= 0" className="w-full px-2 py-1 text-sm border border-input rounded bg-background font-mono" />
            </div>
            <div>
              <label className="text-[10px] font-medium block mb-0.5">Metrics (select related metrics)</label>
              <select multiple value={c.metrics} onChange={(e) => update(i, { metrics: Array.from(e.target.selectedOptions, (o) => o.value) })} className="w-full px-2 py-1 text-sm border border-input rounded bg-background h-16">
                {metricNames.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-medium block mb-0.5">Description</label>
              <input value={c.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="Why this constraint exists" className="w-full px-2 py-1 text-sm border border-input rounded bg-background" />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
            No constraints defined. Add one or skip this step.
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent">Back</button>
        <button onClick={onNext} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
          {items.length > 0 ? "Continue to Review" : "Skip & Continue"}
        </button>
      </div>
    </div>
  );
}

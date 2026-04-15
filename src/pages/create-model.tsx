import { useState, useEffect, useRef } from "react";
import { WizardProgress } from "@/components/wizard/wizard-progress";
import { StepProject, type ProjectStepData } from "@/components/wizard/step-project";
import { StepImport, type ImportSource } from "@/components/wizard/step-import";
import { StepDatasets } from "@/components/wizard/step-datasets";
import { StepMetrics } from "@/components/wizard/step-metrics";
import { StepRelationships } from "@/components/wizard/step-relationships";
import { StepGlossaryReview } from "@/components/wizard/step-glossary-review";
import { StepConstraints } from "@/components/wizard/step-constraints";
import { StepReview } from "@/components/wizard/step-review";

interface SemanticDataset {
  tableId: string;
  name: string;
  description: string;
  fqn: string;
  grain: string;
  primaryKey?: string[];
  fields: Array<{ name: string; role: string; type: string; description: string }>;
  ai?: { keywords: string[] };
  _heuristic?: boolean;
  _aiEnhanced?: boolean;
}

interface MetricDraft {
  name: string; sql: string; dataset: string; description: string; accepted: boolean;
}
interface RelDraft {
  name: string; from: string; to: string; on: string; type: string; accepted: boolean;
}
interface GlossaryDraft {
  term: string; definition: string; seeAlso: string[]; accepted: boolean;
}
interface ConstraintDraft {
  name: string; constraintType: string; rule: string; metrics: string[];
  description: string; severity: string;
}

export function CreateModelPage() {
  const [step, setStep] = useState(0);

  // Warn before leaving wizard with unsaved progress
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (step > 0) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [step]);

  // Step 1 state
  const [projectData, setProjectData] = useState<ProjectStepData>({
    modelName: "", modelDescription: "", sqlDialect: "Snowflake",
    introspection: null, selectedBuckets: [], selectedTableIds: [],
  });

  // Skeleton + AI state
  const [datasets, setDatasets] = useState<SemanticDataset[]>([]);
  const [metrics, setMetrics] = useState<MetricDraft[]>([]);
  const [relationships, setRelationships] = useState<RelDraft[]>([]);
  const [glossary, setGlossary] = useState<GlossaryDraft[]>([]);
  const [constraints, setConstraints] = useState<ConstraintDraft[]>([]);

  // Skeleton loading
  const [skeletonLoading, setSkeletonLoading] = useState(false);
  const [skeletonError, setSkeletonError] = useState("");
  const [rawTables, setRawTables] = useState<Record<string, unknown> | null>(null);

  // AI streaming state (dataset enhancement only)
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [aiProgress, setAiProgress] = useState({ completed: 0, total: 0 });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Per-step AI suggestion tracking — use ref for synchronous reads
  const aiSuggestedRef = useRef(new Set<number>());
  const [aiLoadingStep, setAiLoadingStep] = useState<number | null>(null);

  // Import source
  const [importSource, setImportSource] = useState<ImportSource | null>(null);

  // Compute selected table IDs
  const selectedTableIds = (() => {
    if (!projectData.introspection) return [];
    const ids: string[] = [];
    for (const bid of projectData.selectedBuckets) {
      for (const t of projectData.introspection.tablesByBucket[bid] || []) ids.push(t.id);
    }
    return ids;
  })();

  const datasetIds = datasets.map((d) => d.tableId);

  // ── Step-by-step AI suggestions ──
  async function triggerStepAI(targetStep: number) {
    if (aiSuggestedRef.current.has(targetStep)) return;
    aiSuggestedRef.current.add(targetStep);
    setAiLoadingStep(targetStep);
    console.log(`[wizard] Triggering AI for step ${targetStep}`);

    try {
      if (targetStep === 3) {
        // Metrics step: suggest metrics from datasets + SQL transformations
        const resp = await fetch("/backend/suggest-metrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datasets: datasets.map((d) => ({ tableId: d.tableId, name: d.name, fields: d.fields })),
            projectName: projectData.introspection?.projectName || "",
            sqlDialect: projectData.sqlDialect,
            storageUrl: projectData.introspection?.storageUrl || "",
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setMetrics((prev) => {
            const names = new Set(prev.map((m) => m.name));
            const newOnes = (data.metrics || [])
              .filter((m: MetricDraft) => !names.has(m.name))
              .map((m: MetricDraft) => ({ ...m, accepted: true }));
            return newOnes.length ? [...prev, ...newOnes] : prev;
          });
        }
      } else if (targetStep === 4) {
        // Relationships step
        const resp = await fetch("/backend/suggest-relationships", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ datasets, sqlDialect: projectData.sqlDialect }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setRelationships((prev) => {
            const keys = new Set(prev.map((r) => `${r.from}→${r.to}`));
            const newOnes = (data.relationships || [])
              .filter((r: RelDraft) => !keys.has(`${r.from}→${r.to}`))
              .map((r: RelDraft) => ({ ...r, accepted: true }));
            return newOnes.length ? [...prev, ...newOnes] : prev;
          });
        }
      } else if (targetStep === 5) {
        // Glossary step
        console.log(`[wizard] Requesting glossary with ${datasets.length} datasets, ${metrics.filter(m => m.accepted).length} metrics`);
        const resp = await fetch("/backend/suggest-glossary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            datasets: datasets.map((d) => ({ tableId: d.tableId, name: d.name, description: d.description })),
            metrics: metrics.filter((m) => m.accepted).map((m) => ({ name: m.name, description: m.description })),
            projectName: projectData.introspection?.projectName || "",
          }),
        });
        const glossaryData = await resp.json();
        console.log(`[wizard] Glossary response:`, resp.status, `${glossaryData.glossary?.length || 0} items`);
        if (resp.ok && glossaryData.glossary?.length) {
          setGlossary((prev) => {
            const terms = new Set(prev.map((g) => g.term));
            const newOnes = (glossaryData.glossary || [])
              .filter((g: GlossaryDraft) => !terms.has(g.term))
              .map((g: GlossaryDraft) => ({ ...g, accepted: true }));
            return newOnes.length ? [...prev, ...newOnes] : prev;
          });
        }
      } else if (targetStep === 6) {
        // Constraints step
        const acceptedMetrics = metrics.filter((m) => m.accepted);
        console.log(`[wizard] Requesting constraints with ${acceptedMetrics.length} metrics`);
        const resp = await fetch("/backend/suggest-constraints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metrics: acceptedMetrics.map((m) => ({ name: m.name, sql: m.sql, description: m.description })),
            datasets: datasets.map((d) => ({ tableId: d.tableId, name: d.name })),
          }),
        });
        const constraintData = await resp.json();
        console.log(`[wizard] Constraints response:`, resp.status, `${constraintData.constraints?.length || 0} items`);
        if (resp.ok && constraintData.constraints?.length) {
          setConstraints((prev) => {
            const names = new Set(prev.map((c) => c.name));
            const newOnes = (constraintData.constraints || [])
              .filter((c: ConstraintDraft) => !names.has(c.name));
            return newOnes.length ? [...prev, ...newOnes] : prev;
          });
        }
      }
    } catch (err) {
      console.error(`[step-ai] Step ${targetStep} failed:`, err);
    } finally {
      setAiLoadingStep(null);
    }
  }

  // Trigger AI when entering a step
  function goToStep(targetStep: number) {
    setStep(targetStep);
    // Always trigger AI suggestions for these steps (ref prevents duplicates)
    if ([3, 4, 5, 6].includes(targetStep)) {
      triggerStepAI(targetStep);
    }
  }

  // ── Step 1 → 2: Auto-build skeleton ──
  async function handleProjectNext() {
    setSkeletonLoading(true);
    setSkeletonError("");
    try {
      const resp = await fetch("/backend/skeleton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableIds: selectedTableIds,
          storageUrl: projectData.introspection?.storageUrl || "",
        }),
      });
      if (!resp.ok) throw new Error("Failed to build skeleton");
      const data = await resp.json();

      setDatasets(data.datasets || []);
      // Include heuristic metrics as accepted by default (user can reject)
      setMetrics((data.metrics || []).map((m: Record<string, string>) => ({ ...m, accepted: true })));
      setRelationships((data.relationships || []).map((r: Record<string, string>) => ({ ...r, accepted: true })));
      setRawTables(data.tables || null);
      setStep(1);
    } catch (err) {
      setSkeletonError(err instanceof Error ? err.message : "Failed to build skeleton");
    } finally {
      setSkeletonLoading(false);
    }
  }

  // ── Step 2: Import source selected ──
  function handleImportSelect(source: ImportSource, data?: unknown) {
    setImportSource(source);

    if (source === "file" && data) {
      const result = data as Record<string, unknown[]>;
      if (result.suggestedMetrics) {
        setMetrics((prev) => [
          ...prev,
          ...(result.suggestedMetrics as MetricDraft[]).map((m) => ({ ...m, accepted: true })),
        ]);
      }
      if (result.suggestedGlossary) {
        setGlossary((prev) => [
          ...prev,
          ...(result.suggestedGlossary as GlossaryDraft[]).map((g) => ({ ...g, accepted: true })),
        ]);
      }
    }

    // Start AI dataset enhancement if "from scratch"
    if (source === "scratch" && rawTables) {
      startAiClassification(rawTables);
    }

    setStep(2);
  }

  // ── AI streaming classification (datasets only) ──
  async function startAiClassification(tables: Record<string, unknown>) {
    try {
      const resp = await fetch("/backend/classify-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tables,
          projectName: projectData.introspection?.projectName || "",
          sqlDialect: projectData.sqlDialect,
        }),
      });
      if (!resp.ok) return;
      const { jobId, totalCount } = await resp.json();
      setAiJobId(jobId);
      setAiProgress({ completed: 0, total: totalCount });
    } catch (err) {
      console.error("Failed to start AI classification:", err);
    }
  }

  // Poll for AI dataset enhancement results
  useEffect(() => {
    if (!aiJobId) return;

    pollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`/backend/classify-stream/${aiJobId}`);
        if (!resp.ok) return;
        const job = await resp.json();

        setAiProgress({ completed: job.completedCount, total: job.totalCount });

        // Merge completed tables into datasets
        if (job.completed?.length) {
          setDatasets((prev) => {
            const updated = [...prev];
            for (const item of job.completed) {
              const idx = updated.findIndex((d) => d.tableId === item.tableId);
              if (idx >= 0 && item.dataset) {
                updated[idx] = { ...updated[idx], ...item.dataset, _heuristic: false, _aiEnhanced: true };
              }
            }
            return updated;
          });
        }

        if (job.status === "done") {
          clearInterval(pollRef.current!);
          setAiJobId(null);
        }
      } catch { /* ignore poll errors */ }
    }, 1500);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [aiJobId]);

  // ── Build final objects ──
  function getFinalObjects() {
    return {
      datasets,
      metrics: metrics.filter((m) => m.accepted),
      relationships: relationships.filter((r) => r.accepted),
      glossary: glossary.filter((g) => g.accepted),
      constraints,
    };
  }

  return (
    <div>
      <WizardProgress currentStep={step} />

      {step === 0 && (
        <StepProject
          data={projectData}
          onChange={setProjectData}
          onNext={handleProjectNext}
          loading={skeletonLoading}
          error={skeletonError}
        />
      )}

      {step === 1 && (
        <StepImport
          onSelect={handleImportSelect}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && (
        <StepDatasets
          datasets={datasets}
          onDatasetsChange={setDatasets}
          aiProgress={aiJobId ? aiProgress : null}
          onNext={() => goToStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <StepMetrics
          metrics={metrics}
          datasetIds={datasetIds}
          onChange={setMetrics}
          onNext={() => goToStep(4)}
          onBack={() => setStep(2)}
          aiLoading={aiLoadingStep === 3}
        />
      )}

      {step === 4 && (
        <StepRelationships
          relationships={relationships}
          datasetIds={datasetIds}
          onChange={setRelationships}
          onNext={() => goToStep(5)}
          onBack={() => goToStep(3)}
        />
      )}

      {step === 5 && (
        <StepGlossaryReview
          glossary={glossary}
          datasetIds={datasetIds}
          onChange={setGlossary}
          onNext={() => goToStep(6)}
          onBack={() => goToStep(4)}
          aiLoading={aiLoadingStep === 5}
        />
      )}

      {step === 6 && (
        <StepConstraints
          constraints={constraints}
          metricNames={metrics.filter((m) => m.accepted).map((m) => m.name)}
          onChange={setConstraints}
          onNext={() => setStep(7)}
          onBack={() => goToStep(5)}
          aiLoading={aiLoadingStep === 6}
        />
      )}

      {step === 7 && (() => {
        const final = getFinalObjects();
        return (
          <StepReview
            model={{
              name: projectData.modelName,
              description: projectData.modelDescription,
              sql_dialect: projectData.sqlDialect,
            }}
            datasets={final.datasets}
            metrics={final.metrics}
            relationships={final.relationships}
            glossary={final.glossary}
            constraints={final.constraints}
            onModelChange={(updates) => setProjectData((prev) => ({ ...prev, ...updates }))}
            onBack={() => setStep(6)}
          />
        );
      })()}
    </div>
  );
}

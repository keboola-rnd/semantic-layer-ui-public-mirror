import { useState } from "react";
import { WizardProgress } from "@/components/wizard/wizard-progress";
import { StepProject, type ProjectStepData } from "@/components/wizard/step-project";
import { StepDatasets } from "@/components/wizard/step-datasets";
import { StepMetrics } from "@/components/wizard/step-metrics";
import { StepEnrich } from "@/components/wizard/step-enrich";
import { StepReview } from "@/components/wizard/step-review";

interface ClassifyResult {
  datasets: Array<Record<string, unknown>>;
  metrics: Array<{ name: string; sql: string; dataset: string; description: string; accepted?: boolean }>;
  relationships: Array<Record<string, unknown>>;
  glossary: Array<Record<string, unknown>>;
}

interface Suggestion {
  type: "metric" | "glossary" | "fieldUpdate" | "relationship";
  data: Record<string, unknown>;
  accepted: boolean;
  source: string;
}

export function CreateModelPage() {
  const [step, setStep] = useState(0);

  // Step 1 state
  const [projectData, setProjectData] = useState<ProjectStepData>({
    modelName: "",
    modelDescription: "",
    sqlDialect: "Snowflake",
    introspection: null,
    selectedBuckets: [],
    selectedTableIds: [],
  });

  // Step 2-3 state (from AI classification)
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [metrics, setMetrics] = useState<Array<{ name: string; sql: string; dataset: string; description: string; accepted: boolean }>>([]);

  // Step 4 state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  function handleClassified(result: ClassifyResult) {
    setClassifyResult(result);
    setMetrics(
      (result.metrics || []).map((m) => ({ ...m, accepted: true }))
    );
  }

  // Build final objects for creation
  function getFinalObjects() {
    const datasets = classifyResult?.datasets || [];
    const acceptedMetrics = metrics.filter((m) => m.accepted);
    let relationships = [...(classifyResult?.relationships || [])];
    let glossary = [...(classifyResult?.glossary || [])];

    // Merge accepted suggestions from enrichment
    for (const s of suggestions.filter((s) => s.accepted)) {
      if (s.type === "metric") acceptedMetrics.push(s.data as typeof acceptedMetrics[0]);
      if (s.type === "glossary") glossary.push(s.data as typeof glossary[0]);
      if (s.type === "relationship") relationships.push(s.data as typeof relationships[0]);
    }

    return { datasets, metrics: acceptedMetrics, relationships, glossary };
  }

  // Compute selected table IDs from introspection + bucket selection
  const selectedTableIds = (() => {
    if (!projectData.introspection) return [];
    const ids: string[] = [];
    for (const bid of projectData.selectedBuckets) {
      const tables = projectData.introspection.tablesByBucket[bid] || [];
      for (const t of tables) ids.push(t.id);
    }
    return ids;
  })();

  const datasetIds = (classifyResult?.datasets || []).map(
    (d) => (d as Record<string, string>).tableId
  );

  const modelContext = {
    datasets: classifyResult?.datasets || [],
    metrics: metrics.filter((m) => m.accepted),
    relationships: classifyResult?.relationships || [],
    glossary: classifyResult?.glossary || [],
  };

  return (
    <div>
      <WizardProgress currentStep={step} />

      {step === 0 && (
        <StepProject
          data={projectData}
          onChange={setProjectData}
          onNext={() => setStep(1)}
        />
      )}

      {step === 1 && (
        <StepDatasets
          tableIds={selectedTableIds}
          storageUrl={projectData.introspection?.storageUrl || ""}
          projectName={projectData.introspection?.projectName || ""}
          sqlDialect={projectData.sqlDialect}
          classifyResult={classifyResult as Parameters<typeof StepDatasets>[0]["classifyResult"]}
          onClassified={handleClassified}
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && (
        <StepMetrics
          metrics={metrics}
          datasetIds={datasetIds}
          onChange={setMetrics}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <StepEnrich
          modelContext={modelContext}
          suggestions={suggestions}
          onSuggestionsChange={setSuggestions}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (() => {
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
            onBack={() => setStep(3)}
          />
        );
      })()}
    </div>
  );
}

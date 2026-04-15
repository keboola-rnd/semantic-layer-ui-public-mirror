import { useModelsOnly, useModelObjects } from "./use-all-objects";
import type { ModelSummary } from "@/lib/types";

export function useModels() {
  return useModelsOnly();
}

export function useModelSummaries() {
  const { data: models, ...rest } = useModelsOnly();

  const summaries: ModelSummary[] | undefined = models
    ? models.map((m) => ({
        name: m.attributes.name,
        uuid: m.id,
        description: m.attributes.description || "",
        sql_dialect: m.attributes.sql_dialect,
        // Counts will be loaded lazily when model is selected
        datasetCount: 0,
        metricCount: 0,
        relationshipCount: 0,
        glossaryCount: 0,
        constraintCount: 0,
      }))
    : undefined;

  return { data: summaries, ...rest };
}

/** Get summary for a single model with real counts */
export function useModelDetail(modelUUID: string) {
  const { data: models } = useModelsOnly();
  const { data: objects, isLoading } = useModelObjects(modelUUID);
  const model = models?.find((m) => m.id === modelUUID);

  if (!model) return { data: undefined, isLoading: true };

  const summary: ModelSummary = {
    name: model.attributes.name,
    uuid: model.id,
    description: model.attributes.description || "",
    sql_dialect: model.attributes.sql_dialect,
    datasetCount: objects?.datasets.length ?? 0,
    metricCount: objects?.metrics.length ?? 0,
    relationshipCount: objects?.relationships.length ?? 0,
    glossaryCount: objects?.glossary.length ?? 0,
    constraintCount: objects?.constraints.length ?? 0,
  };

  return { data: summary, isLoading };
}

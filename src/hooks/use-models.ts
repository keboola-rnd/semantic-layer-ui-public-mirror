import { useAllObjects } from "./use-all-objects";
import type { ModelSummary } from "@/lib/types";

export function useModels() {
  const { data, ...rest } = useAllObjects();
  return { data: data?.models, ...rest };
}

export function useModelSummaries() {
  const { data, ...rest } = useAllObjects();

  const summaries: ModelSummary[] | undefined = data
    ? data.models.map((m) => ({
        name: m.attributes.name,
        uuid: m.id,
        description: m.attributes.description || "",
        sql_dialect: m.attributes.sql_dialect,
        datasetCount: data.datasets.filter((d) => d.attributes.modelUUID === m.id).length,
        metricCount: data.metrics.filter((d) => d.attributes.modelUUID === m.id).length,
        relationshipCount: data.relationships.filter((d) => d.attributes.modelUUID === m.id).length,
        glossaryCount: data.glossary.filter((d) => d.attributes.modelUUID === m.id).length,
        constraintCount: data.constraints.filter((d) => d.attributes.modelUUID === m.id).length,
      }))
    : undefined;

  return { data: summaries, ...rest };
}

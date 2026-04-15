import { useQuery } from "@tanstack/react-query";
import { listObjects } from "@/lib/api-client";
import type {
  SemanticModel,
  SemanticDataset,
  SemanticMetric,
  SemanticRelationship,
  SemanticGlossary,
  SemanticConstraint,
  MetastoreObject,
} from "@/lib/types";

export interface AllObjects {
  models: MetastoreObject<SemanticModel>[];
  datasets: MetastoreObject<SemanticDataset>[];
  metrics: MetastoreObject<SemanticMetric>[];
  relationships: MetastoreObject<SemanticRelationship>[];
  glossary: MetastoreObject<SemanticGlossary>[];
  constraints: MetastoreObject<SemanticConstraint>[];
}

/** Fetch only models — lightweight, used for model selector/dashboard */
export function useModelsOnly() {
  return useQuery({
    queryKey: ["models"],
    queryFn: () => listObjects<SemanticModel>("semantic-model"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch all child objects for a specific model */
export function useModelObjects(modelUUID: string) {
  return useQuery({
    queryKey: ["model-objects", modelUUID],
    queryFn: async () => {
      const [datasets, metrics, relationships, glossary, constraints] =
        await Promise.all([
          listObjects<SemanticDataset>("semantic-dataset", modelUUID),
          listObjects<SemanticMetric>("semantic-metric", modelUUID),
          listObjects<SemanticRelationship>("semantic-relationship", modelUUID),
          listObjects<SemanticGlossary>("semantic-glossary", modelUUID),
          listObjects<SemanticConstraint>("semantic-constraint", modelUUID),
        ]);
      return { datasets, metrics, relationships, glossary, constraints };
    },
    enabled: !!modelUUID,
    staleTime: 5 * 60 * 1000,
  });
}

/** Legacy: Fetch ALL semantic objects — still used by some pages.
 *  Prefer useModelsOnly + useModelObjects for better performance. */
export function useAllObjects() {
  return useQuery({
    queryKey: ["all-objects"],
    queryFn: async (): Promise<AllObjects> => {
      const [models, datasets, metrics, relationships, glossary, constraints] =
        await Promise.all([
          listObjects<SemanticModel>("semantic-model"),
          listObjects<SemanticDataset>("semantic-dataset"),
          listObjects<SemanticMetric>("semantic-metric"),
          listObjects<SemanticRelationship>("semantic-relationship"),
          listObjects<SemanticGlossary>("semantic-glossary"),
          listObjects<SemanticConstraint>("semantic-constraint"),
        ]);
      return { models, datasets, metrics, relationships, glossary, constraints };
    },
    staleTime: 5 * 60 * 1000,
  });
}

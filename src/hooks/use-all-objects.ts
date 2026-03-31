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

/** Fetch ALL semantic objects once — all types in parallel.
 *  This single query populates everything the app needs. */
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

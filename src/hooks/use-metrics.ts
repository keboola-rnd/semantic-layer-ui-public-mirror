import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { getObject, createObject, updateObject, deleteObject } from "@/lib/api-client";
import { useModelObjects } from "./use-all-objects";
import type { SemanticMetric } from "@/lib/types";

export function useMetrics(modelUUID: string) {
  const { data, ...rest } = useModelObjects(modelUUID);
  return { data: data?.metrics, ...rest };
}

export function useMetric(uuid: string) {
  return useQuery({
    queryKey: ["metric", uuid],
    queryFn: () => getObject<SemanticMetric>("semantic-metric", uuid),
    enabled: !!uuid,
  });
}

export function useCreateMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SemanticMetric) =>
      createObject("semantic-metric", data.name, data as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model-objects"] }),
  });
}

export function useUpdateMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Partial<SemanticMetric> }) =>
      updateObject("semantic-metric", uuid, data as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["model-objects"] });
      qc.invalidateQueries({ queryKey: ["metric"] });
    },
  });
}

export function useDeleteMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => deleteObject("semantic-metric", uuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model-objects"] }),
  });
}

import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { getObject, createObject, updateObject, deleteObject } from "@/lib/api-client";
import { useAllObjects } from "./use-all-objects";
import type { SemanticMetric } from "@/lib/types";

export function useMetrics(modelUUID: string) {
  const { data, ...rest } = useAllObjects();
  const filtered = data?.metrics.filter(
    (d) => !modelUUID || d.attributes.modelUUID === modelUUID
  );
  return { data: filtered, ...rest };
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-objects"] }),
  });
}

export function useUpdateMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Partial<SemanticMetric> }) =>
      updateObject("semantic-metric", uuid, data as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-objects"] });
      qc.invalidateQueries({ queryKey: ["metric"] });
    },
  });
}

export function useDeleteMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => deleteObject("semantic-metric", uuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-objects"] }),
  });
}

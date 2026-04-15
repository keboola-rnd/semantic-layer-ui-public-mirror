import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getObject, createObject, updateObject, deleteObject } from "@/lib/api-client";
import { useModelObjects } from "./use-all-objects";
import type { SemanticDataset } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

export function useDatasets(modelUUID: string) {
  const { data, ...rest } = useModelObjects(modelUUID);
  return { data: data?.datasets, ...rest };
}

export function useDataset(uuid: string) {
  return useQuery({
    queryKey: ["dataset", uuid],
    queryFn: () => getObject<SemanticDataset>("semantic-dataset", uuid),
    enabled: !!uuid,
  });
}

export function useCreateDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SemanticDataset) =>
      createObject("semantic-dataset", data.name, data as unknown as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["model-objects"] });
    },
  });
}

export function useUpdateDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Partial<SemanticDataset> }) =>
      updateObject("semantic-dataset", uuid, data as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["model-objects"] });
      qc.invalidateQueries({ queryKey: ["dataset"] });
    },
  });
}

export function useDeleteDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => deleteObject("semantic-dataset", uuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model-objects"] }),
  });
}

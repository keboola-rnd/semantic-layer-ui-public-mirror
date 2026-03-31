import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getObject, createObject, updateObject, deleteObject } from "@/lib/api-client";
import { useAllObjects } from "./use-all-objects";
import type { SemanticDataset } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

export function useDatasets(modelUUID: string) {
  const { data, ...rest } = useAllObjects();
  const filtered = data?.datasets.filter(
    (d) => !modelUUID || d.attributes.modelUUID === modelUUID
  );
  return { data: filtered, ...rest };
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-objects"] }),
  });
}

export function useUpdateDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Partial<SemanticDataset> }) =>
      updateObject("semantic-dataset", uuid, data as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-objects"] });
      qc.invalidateQueries({ queryKey: ["dataset"] });
    },
  });
}

export function useDeleteDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => deleteObject("semantic-dataset", uuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-objects"] }),
  });
}

import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { getObject, createObject, updateObject, deleteObject } from "@/lib/api-client";
import { useModelObjects } from "./use-all-objects";
import type { SemanticConstraint } from "@/lib/types";

export function useConstraints(modelUUID: string) {
  const { data, ...rest } = useModelObjects(modelUUID);
  return { data: data?.constraints, ...rest };
}

export function useConstraint(uuid: string) {
  return useQuery({
    queryKey: ["constraint", uuid],
    queryFn: () => getObject<SemanticConstraint>("semantic-constraint", uuid),
    enabled: !!uuid,
  });
}

export function useCreateConstraint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SemanticConstraint) =>
      createObject("semantic-constraint", data.name, data as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model-objects"] }),
  });
}

export function useUpdateConstraint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Partial<SemanticConstraint> }) =>
      updateObject("semantic-constraint", uuid, data as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["model-objects"] });
      qc.invalidateQueries({ queryKey: ["constraint"] });
    },
  });
}

export function useDeleteConstraint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => deleteObject("semantic-constraint", uuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model-objects"] }),
  });
}

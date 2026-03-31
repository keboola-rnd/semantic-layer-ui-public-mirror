import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { getObject, createObject, updateObject, deleteObject } from "@/lib/api-client";
import { useAllObjects } from "./use-all-objects";
import type { SemanticConstraint } from "@/lib/types";

export function useConstraints(modelUUID: string) {
  const { data, ...rest } = useAllObjects();
  const filtered = data?.constraints.filter(
    (d) => !modelUUID || d.attributes.modelUUID === modelUUID
  );
  return { data: filtered, ...rest };
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-objects"] }),
  });
}

export function useUpdateConstraint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Partial<SemanticConstraint> }) =>
      updateObject("semantic-constraint", uuid, data as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-objects"] });
      qc.invalidateQueries({ queryKey: ["constraint"] });
    },
  });
}

export function useDeleteConstraint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => deleteObject("semantic-constraint", uuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-objects"] }),
  });
}

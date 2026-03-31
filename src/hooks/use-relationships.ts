import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createObject, updateObject, deleteObject } from "@/lib/api-client";
import { useAllObjects } from "./use-all-objects";
import type { SemanticRelationship } from "@/lib/types";

export function useRelationships(modelUUID: string) {
  const { data, ...rest } = useAllObjects();
  const filtered = data?.relationships.filter(
    (d) => !modelUUID || d.attributes.modelUUID === modelUUID
  );
  return { data: filtered, ...rest };
}

export function useCreateRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SemanticRelationship) =>
      createObject("semantic-relationship", data.name || `${data.from}_to_${data.to}`, data as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-objects"] }),
  });
}

export function useUpdateRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Partial<SemanticRelationship> }) =>
      updateObject("semantic-relationship", uuid, data as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-objects"] }),
  });
}

export function useDeleteRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => deleteObject("semantic-relationship", uuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-objects"] }),
  });
}

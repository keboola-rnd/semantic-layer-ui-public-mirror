import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createObject, updateObject, deleteObject } from "@/lib/api-client";
import { useModelObjects } from "./use-all-objects";
import type { SemanticRelationship } from "@/lib/types";

export function useRelationships(modelUUID: string) {
  const { data, ...rest } = useModelObjects(modelUUID);
  return { data: data?.relationships, ...rest };
}

export function useCreateRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SemanticRelationship) =>
      createObject("semantic-relationship", data.name || `${data.from}_to_${data.to}`, data as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model-objects"] }),
  });
}

export function useUpdateRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Partial<SemanticRelationship> }) =>
      updateObject("semantic-relationship", uuid, data as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model-objects"] }),
  });
}

export function useDeleteRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => deleteObject("semantic-relationship", uuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model-objects"] }),
  });
}

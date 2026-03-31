import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { getObject, createObject, updateObject, deleteObject } from "@/lib/api-client";
import { useAllObjects } from "./use-all-objects";
import type { SemanticGlossary } from "@/lib/types";

export function useGlossary(modelUUID: string) {
  const { data, ...rest } = useAllObjects();
  const filtered = data?.glossary.filter(
    (d) => !modelUUID || d.attributes.modelUUID === modelUUID
  );
  return { data: filtered, ...rest };
}

export function useGlossaryTerm(uuid: string) {
  return useQuery({
    queryKey: ["glossary-term", uuid],
    queryFn: () => getObject<SemanticGlossary>("semantic-glossary", uuid),
    enabled: !!uuid,
  });
}

export function useCreateGlossaryTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SemanticGlossary) =>
      createObject("semantic-glossary", data.term, data as unknown as Record<string, unknown>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-objects"] }),
  });
}

export function useUpdateGlossaryTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Partial<SemanticGlossary> }) =>
      updateObject("semantic-glossary", uuid, data as Record<string, unknown>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-objects"] });
      qc.invalidateQueries({ queryKey: ["glossary-term"] });
    },
  });
}

export function useDeleteGlossaryTerm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => deleteObject("semantic-glossary", uuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-objects"] }),
  });
}

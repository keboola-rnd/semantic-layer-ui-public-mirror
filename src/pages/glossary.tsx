import { useGlossary } from "@/hooks/use-glossary";
import { useModel } from "@/providers/model-context";
import { Link } from "react-router";
import { truncate } from "@/lib/utils";
import { useState } from "react";

export function GlossaryPage() {
  const { modelUUID } = useModel();
  const { data: terms, isLoading } = useGlossary(modelUUID);
  const [search, setSearch] = useState("");

  const filtered = terms?.filter(
    (g) =>
      g.attributes.term.toLowerCase().includes(search.toLowerCase()) ||
      g.attributes.definition.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Glossary{" "}
          <span className="text-muted-foreground font-normal text-sm">
            ({filtered?.length || 0})
          </span>
        </h2>
        <input
          type="text"
          placeholder="Search terms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-input rounded-md bg-background w-64 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        {filtered?.map((g) => (
          <Link
            key={g.id}
            to={`/glossary/${g.id}`}
            className="block border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{g.attributes.term}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {truncate(g.attributes.definition, 150)}
                </p>
              </div>
              {g.attributes.seeAlso && g.attributes.seeAlso.length > 0 && (
                <div className="flex gap-1 shrink-0">
                  {g.attributes.seeAlso.slice(0, 3).map((ref) => (
                    <span
                      key={ref}
                      className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono"
                    >
                      {ref.split(".").pop()}
                    </span>
                  ))}
                  {g.attributes.seeAlso.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{g.attributes.seeAlso.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

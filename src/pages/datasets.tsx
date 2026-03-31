import { useDatasets } from "@/hooks/use-datasets";
import { useModel } from "@/providers/model-context";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { ROLE_COLORS } from "@/lib/constants";
import { useState } from "react";

export function DatasetsPage() {
  const { modelUUID } = useModel();
  const { data: datasets, isLoading } = useDatasets(modelUUID);
  const [search, setSearch] = useState("");

  const filtered = datasets?.filter(
    (d) =>
      d.attributes.name.toLowerCase().includes(search.toLowerCase()) ||
      d.attributes.tableId.toLowerCase().includes(search.toLowerCase()) ||
      (d.attributes.description || "").toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Datasets{" "}
          <span className="text-muted-foreground font-normal text-sm">
            ({filtered?.length || 0})
          </span>
        </h2>
        <input
          type="text"
          placeholder="Search datasets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 text-sm border border-input rounded-md bg-background w-64 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-3 py-2 font-medium w-[160px]">Name</th>
              <th className="text-left px-3 py-2 font-medium w-[50px]">Fields</th>
              <th className="text-left px-3 py-2 font-medium">Roles</th>
              <th className="text-left px-3 py-2 font-medium">Grain</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map((d) => {
              const fields = d.attributes.fields || [];
              const roleCounts: Record<string, number> = {};
              for (const f of fields) {
                const r = f.role || "unknown";
                roleCounts[r] = (roleCounts[r] || 0) + 1;
              }
              return (
                <tr
                  key={d.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      to={`/datasets/${d.id}`}
                      className="font-medium text-primary hover:underline block"
                    >
                      {d.attributes.name}
                    </Link>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {d.attributes.tableId}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-center">
                    {fields.length}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(roleCounts).map(([role, count]) => (
                        <span
                          key={role}
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap",
                            ROLE_COLORS[role] || "bg-gray-100 text-gray-600"
                          )}
                        >
                          {count} {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {d.attributes.grain || "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

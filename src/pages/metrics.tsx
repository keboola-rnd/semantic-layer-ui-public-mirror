import { useMetrics } from "@/hooks/use-metrics";
import { useModel } from "@/providers/model-context";
import { Link } from "react-router";
import { truncate } from "@/lib/utils";
import { useState } from "react";

export function MetricsPage() {
  const { modelUUID } = useModel();
  const { data: metrics, isLoading } = useMetrics(modelUUID);
  const [search, setSearch] = useState("");

  const filtered = metrics?.filter(
    (m) =>
      m.attributes.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.attributes.description || "").toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Metrics{" "}
          <span className="text-muted-foreground font-normal text-sm">
            ({filtered?.length || 0})
          </span>
        </h2>
        <input
          type="text"
          placeholder="Search metrics..."
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
              <th className="text-left px-3 py-2 font-medium">SQL</th>
              <th className="text-left px-3 py-2 font-medium w-[140px]">Dataset</th>
              <th className="text-left px-3 py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map((m) => (
              <tr
                key={m.id}
                className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-2.5">
                  <Link
                    to={`/metrics/${m.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {m.attributes.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    {truncate(m.attributes.sql, 60)}
                  </code>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {m.attributes.dataset || "-"}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs truncate">
                  {truncate(m.attributes.description || "", 80)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

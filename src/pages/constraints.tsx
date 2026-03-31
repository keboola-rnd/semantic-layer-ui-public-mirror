import { useConstraints } from "@/hooks/use-constraints";
import { useModel } from "@/providers/model-context";
import { SEVERITY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ConstraintsPage() {
  const { modelUUID } = useModel();
  const { data: constraints, isLoading } = useConstraints(modelUUID);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (!constraints || constraints.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Constraints</h2>
        <div className="text-center py-20 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">No constraints defined for this model.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Constraints define business rules between metrics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        Constraints{" "}
        <span className="text-muted-foreground font-normal text-sm">
          ({constraints.length})
        </span>
      </h2>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Type</th>
              <th className="text-left px-4 py-2 font-medium">Severity</th>
              <th className="text-left px-4 py-2 font-medium">Rule</th>
              <th className="text-left px-4 py-2 font-medium">Metrics</th>
            </tr>
          </thead>
          <tbody>
            {constraints.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2 font-medium">
                  {c.attributes.displayName || c.attributes.name}
                </td>
                <td className="px-4 py-2">
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                    {c.attributes.constraintType}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded",
                      SEVERITY_COLORS[c.attributes.severity || "error"]
                    )}
                  >
                    {c.attributes.severity || "error"}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground max-w-xs truncate">
                  {c.attributes.rule}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {c.attributes.metrics.map((m) => (
                      <span key={m} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                        {m}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

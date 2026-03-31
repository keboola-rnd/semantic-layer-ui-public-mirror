import { Command } from "cmdk";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useAllObjects } from "@/hooks/use-all-objects";
import { useModel } from "@/providers/model-context";
import {
  Database,
  BarChart3,
  GitBranch,
  BookOpen,
  ShieldCheck,
  Search,
} from "lucide-react";

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  type: "dataset" | "metric" | "relationship" | "glossary" | "constraint";
  path: string;
}

const TYPE_ICONS = {
  dataset: Database,
  metric: BarChart3,
  relationship: GitBranch,
  glossary: BookOpen,
  constraint: ShieldCheck,
};

const TYPE_COLORS = {
  dataset: "text-blue-500",
  metric: "text-green-500",
  relationship: "text-purple-500",
  glossary: "text-orange-500",
  constraint: "text-red-500",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useAllObjects();
  const { modelUUID } = useModel();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const results = useMemo((): SearchResult[] => {
    if (!data) return [];
    const items: SearchResult[] = [];

    for (const d of data.datasets) {
      if (modelUUID && d.attributes.modelUUID !== modelUUID) continue;
      items.push({
        id: d.id,
        label: d.attributes.name,
        sublabel: `${d.attributes.tableId} - ${(d.attributes.fields || []).length} fields`,
        type: "dataset",
        path: `/datasets/${d.id}`,
      });
      // Also index field names
      for (const f of d.attributes.fields || []) {
        items.push({
          id: `${d.id}-${f.name}`,
          label: `${d.attributes.name}.${f.name}`,
          sublabel: `${f.role || ""} ${f.type || ""} - ${f.description || ""}`.trim(),
          type: "dataset",
          path: `/datasets/${d.id}`,
        });
      }
    }

    for (const m of data.metrics) {
      if (modelUUID && m.attributes.modelUUID !== modelUUID) continue;
      items.push({
        id: m.id,
        label: m.attributes.name,
        sublabel: m.attributes.sql.substring(0, 80),
        type: "metric",
        path: `/metrics/${m.id}`,
      });
    }

    for (const r of data.relationships) {
      if (modelUUID && r.attributes.modelUUID !== modelUUID) continue;
      items.push({
        id: r.id,
        label: r.attributes.name || `${r.attributes.from} -> ${r.attributes.to}`,
        sublabel: `${r.attributes.type || "left"} join: ${r.attributes.on}`,
        type: "relationship",
        path: "/relationships",
      });
    }

    for (const g of data.glossary) {
      if (modelUUID && g.attributes.modelUUID !== modelUUID) continue;
      items.push({
        id: g.id,
        label: g.attributes.term,
        sublabel: g.attributes.definition.substring(0, 100),
        type: "glossary",
        path: `/glossary/${g.id}`,
      });
    }

    for (const c of data.constraints) {
      if (modelUUID && c.attributes.modelUUID !== modelUUID) continue;
      items.push({
        id: c.id,
        label: c.attributes.displayName || c.attributes.name,
        sublabel: `${c.attributes.constraintType}: ${c.attributes.rule}`,
        type: "constraint",
        path: `/constraints/${c.id}`,
      });
    }

    return items;
  }, [data, modelUUID]);

  function handleSelect(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border border-input rounded-md hover:bg-accent transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
          {"\u2318"}K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[15vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <Command
              label="Search semantic layer"
              shouldFilter={true}
              className="flex flex-col"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <Command.Input
                  autoFocus
                  placeholder="Search datasets, metrics, glossary, fields..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <Command.List className="max-h-[400px] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                  No results found.
                </Command.Empty>

                {(["dataset", "metric", "glossary", "relationship", "constraint"] as const).map(
                  (type) => {
                    const typeResults = results.filter((r) => r.type === type);
                    if (typeResults.length === 0) return null;
                    const Icon = TYPE_ICONS[type];
                    return (
                      <Command.Group
                        key={type}
                        heading={
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {type}s
                          </span>
                        }
                        className="mb-2"
                      >
                        {typeResults.map((r) => (
                          <Command.Item
                            key={r.id}
                            value={`${r.label} ${r.sublabel}`}
                            onSelect={() => handleSelect(r.path)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer text-sm data-[selected=true]:bg-accent transition-colors"
                          >
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${TYPE_COLORS[type]}`} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{r.label}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {r.sublabel}
                              </div>
                            </div>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    );
                  }
                )}
              </Command.List>
            </Command>
          </div>
        </div>
      )}
    </>
  );
}

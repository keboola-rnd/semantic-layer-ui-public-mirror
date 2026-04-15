import { useModels } from "@/hooks/use-models";
import { useModel } from "@/providers/model-context";
import { CommandPalette } from "@/components/search/command-palette";
import { ChevronDown } from "lucide-react";
import { useEffect } from "react";

export function Header() {
  const { modelUUID, setModelUUID } = useModel();
  const { data: models } = useModels();

  useEffect(() => {
    if (!modelUUID && models && models.length > 0) {
      setModelUUID(models[0].id);
    }
  }, [modelUUID, models, setModelUUID]);

  const currentModel = models?.find((m) => m.id === modelUUID);

  return (
    <header className="h-12 border-b border-border flex items-center px-4 gap-4 bg-background">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Model:</span>
        <div className="relative">
          <select
            value={modelUUID}
            onChange={(e) => setModelUUID(e.target.value)}
            className="appearance-none bg-secondary text-sm font-medium px-3 py-1 pr-7 rounded-md border border-border cursor-pointer hover:bg-accent transition-colors"
          >
            {models?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.attributes.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none text-muted-foreground" />
        </div>
      </div>

      <CommandPalette />

      {currentModel && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
          <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
            {currentModel.attributes.sql_dialect}
          </span>
        </div>
      )}
    </header>
  );
}

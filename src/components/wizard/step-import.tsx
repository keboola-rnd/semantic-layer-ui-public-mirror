import { useState } from "react";
import { Sparkles, Upload, Globe, Database, FileText, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImportSource = "scratch" | "file" | "openmetadata" | "dawiso" | "powerbi";

export function StepImport({
  onSelect,
  onBack,
}: {
  onSelect: (source: ImportSource, data?: unknown) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<ImportSource | null>(null);
  const [uploading, setUploading] = useState(false);
  const [omUrl, setOmUrl] = useState("");
  const [omToken, setOmToken] = useState("");

  const sources = [
    {
      id: "scratch" as const,
      icon: Sparkles,
      label: "Start from scratch",
      description: "AI will classify your fields and suggest metrics, relationships, and glossary terms. You review and edit each step.",
      available: true,
    },
    {
      id: "file" as const,
      icon: Upload,
      label: "Import from file",
      description: "Upload YAML, JSON, or CSV files from dbt, OpenMetadata, or any tool. AI maps them to your Keboola tables.",
      available: true,
    },
    {
      id: "openmetadata" as const,
      icon: Globe,
      label: "Connect to OpenMetadata",
      description: "Pull your semantic layer directly from an OpenMetadata instance via API.",
      available: true,
    },
    {
      id: "dawiso" as const,
      icon: Database,
      label: "Connect to Dawiso",
      description: "Sync with your Dawiso data catalog.",
      available: false,
      badge: "Coming soon",
    },
    {
      id: "powerbi" as const,
      icon: FileText,
      label: "Import from PowerBI",
      description: "Export your PowerBI semantic model (.bim file) and import it here.",
      available: true,
    },
  ];

  async function handleFileUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", files[0]);
    formData.append("modelContext", JSON.stringify({}));

    try {
      const resp = await fetch("/backend/upload", { method: "POST", body: formData });
      if (!resp.ok) throw new Error("Upload failed");
      const result = await resp.json();
      onSelect("file", result);
    } catch {
      onSelect("file", null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold">How do you want to build your semantic layer?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Your dataset skeleton has been created from Keboola metadata. Choose how to enrich it.
        </p>
      </div>

      <div className="space-y-2">
        {sources.map((s) => (
          <div key={s.id}>
            <button
              onClick={() => setSelected(selected === s.id ? null : s.id)}
              disabled={!s.available}
              className={cn(
                "w-full text-left border rounded-lg p-4 transition-all",
                selected === s.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                !s.available && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="flex items-start gap-3">
                <s.icon className={cn("h-5 w-5 mt-0.5 shrink-0", selected === s.id ? "text-primary" : "text-muted-foreground")} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{s.label}</span>
                    {s.badge && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{s.badge}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                </div>
              </div>
            </button>

            {/* Expanded content for selected source */}
            {selected === s.id && s.id === "file" && (
              <div className="ml-8 mt-2 mb-2">
                <label className="flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary/50">
                  <input type="file" className="hidden" accept=".yaml,.yml,.json,.csv,.bim" onChange={(e) => handleFileUpload(e.target.files)} />
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">Drop file or click to browse (YAML, JSON, CSV, .bim)</span>
                </label>
              </div>
            )}

            {selected === s.id && s.id === "openmetadata" && (
              <div className="ml-8 mt-2 mb-2 space-y-2">
                <input value={omUrl} onChange={(e) => setOmUrl(e.target.value)} placeholder="https://your-openmetadata.example.com" className="w-full px-3 py-1.5 text-sm border border-input rounded-md bg-background" />
                <input value={omToken} onChange={(e) => setOmToken(e.target.value)} placeholder="API Token" type="password" className="w-full px-3 py-1.5 text-sm border border-input rounded-md bg-background" />
                <button
                  onClick={() => onSelect("openmetadata", { url: omUrl, token: omToken })}
                  disabled={!omUrl}
                  className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                >
                  Connect
                </button>
              </div>
            )}

            {selected === s.id && s.id === "powerbi" && (
              <div className="ml-8 mt-2 mb-2 p-4 bg-muted/50 rounded-lg text-xs space-y-2">
                <p className="font-medium">To export your PowerBI semantic model:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Open your PowerBI model in PowerBI Desktop</li>
                  <li>Go to <strong>File → Export → Power BI template (.pbit)</strong></li>
                  <li>Or use Tabular Editor: <strong>File → Save As → Model.bim</strong></li>
                  <li>Upload the .bim or .pbit file above</li>
                </ol>
                <label className="flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 mt-3">
                  <input type="file" className="hidden" accept=".bim,.pbit,.json" onChange={(e) => handleFileUpload(e.target.files)} />
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">Upload .bim or .pbit file</span>
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent">
          Back
        </button>
        {selected && (selected === "scratch" || selected === "dawiso") && (
          <button
            onClick={() => onSelect(selected)}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2"
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

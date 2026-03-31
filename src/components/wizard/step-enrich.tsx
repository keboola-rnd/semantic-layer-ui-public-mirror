import { useState, useCallback } from "react";
import { Upload, FileText, Loader2, Check, X, Sparkles } from "lucide-react";

interface Suggestion {
  type: "metric" | "glossary" | "fieldUpdate" | "relationship";
  data: Record<string, unknown>;
  accepted: boolean;
  source: string; // filename
}

export function StepEnrich({
  modelContext,
  suggestions,
  onSuggestionsChange,
  onNext,
  onBack,
}: {
  modelContext: Record<string, unknown>;
  suggestions: Suggestion[];
  onSuggestionsChange: (s: Suggestion[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setError("");

      const newSuggestions = [...suggestions];

      for (const file of Array.from(files)) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("modelContext", JSON.stringify(modelContext));

          const resp = await fetch("/backend/upload", {
            method: "POST",
            body: formData,
          });

          if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error || "Upload failed");
          }

          const result = await resp.json();
          setUploadedFiles((prev) => [...prev, file.name]);

          // Convert results to suggestions
          for (const m of result.suggestedMetrics || []) {
            newSuggestions.push({ type: "metric", data: m, accepted: true, source: file.name });
          }
          for (const g of result.suggestedGlossary || []) {
            newSuggestions.push({ type: "glossary", data: g, accepted: true, source: file.name });
          }
          for (const u of result.fieldUpdates || []) {
            newSuggestions.push({ type: "fieldUpdate", data: u, accepted: true, source: file.name });
          }
          for (const r of result.suggestedRelationships || []) {
            newSuggestions.push({ type: "relationship", data: r, accepted: true, source: file.name });
          }
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Upload failed");
        }
      }

      onSuggestionsChange(newSuggestions);
      setUploading(false);
    },
    [modelContext, suggestions, onSuggestionsChange]
  );

  function toggleSuggestion(index: number) {
    const next = [...suggestions];
    next[index] = { ...next[index], accepted: !next[index].accepted };
    onSuggestionsChange(next);
  }

  const typeLabels = {
    metric: "New Metric",
    glossary: "Glossary Term",
    fieldUpdate: "Field Update",
    relationship: "Relationship",
  };

  const typeColors = {
    metric: "text-green-600",
    glossary: "text-orange-600",
    fieldUpdate: "text-blue-600",
    relationship: "text-purple-600",
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Enrich with Documentation</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Upload files (PDF, YAML, Markdown, TXT) to extract additional metrics, glossary terms, and descriptions.
          This step is optional.
        </p>
      </div>

      {/* Drop zone */}
      <label
        className="flex flex-col items-center gap-3 border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files); }}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.yaml,.yml,.md,.txt,.json,.csv"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        {uploading ? (
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <div className="text-center">
          <p className="text-sm font-medium">
            {uploading ? "Processing files with AI..." : "Drop files here or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, YAML, Markdown, TXT, JSON, CSV (max 10MB)
          </p>
        </div>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Uploaded files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground">Processed Files</h4>
          {uploadedFiles.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              {f}
              <Check className="h-3.5 w-3.5 text-green-600" />
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            AI Suggestions ({suggestions.filter((s) => s.accepted).length}/{suggestions.length} accepted)
          </h4>
          {suggestions.map((s, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 border rounded-lg p-3 ${s.accepted ? "border-border" : "border-border/50 opacity-50"}`}
            >
              <Sparkles className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${typeColors[s.type]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
                    {typeLabels[s.type]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">from {s.source}</span>
                </div>
                <div className="text-xs mt-1">
                  {s.type === "metric" && (
                    <span><strong>{(s.data as Record<string, string>).name}</strong>: <code>{(s.data as Record<string, string>).sql}</code></span>
                  )}
                  {s.type === "glossary" && (
                    <span><strong>{(s.data as Record<string, string>).term}</strong>: {(s.data as Record<string, string>).definition?.substring(0, 100)}</span>
                  )}
                  {s.type === "fieldUpdate" && (
                    <span>{(s.data as Record<string, string>).tableId}.{(s.data as Record<string, string>).fieldName}: {(s.data as Record<string, string>).description}</span>
                  )}
                  {s.type === "relationship" && (
                    <span>{(s.data as Record<string, string>).from} → {(s.data as Record<string, string>).to}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleSuggestion(i)}
                className={`p-1 ${s.accepted ? "text-green-600" : "text-muted-foreground"}`}
              >
                {s.accepted ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent">
          Back
        </button>
        <button onClick={onNext} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
          {suggestions.length > 0 ? "Continue to Review" : "Skip & Continue"}
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { setToken } from "@/lib/api-client";

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [tokenValue, setTokenValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Test the token by hitting health-check (no auth needed) then listing models
      setToken(tokenValue);
      const resp = await fetch("/api/v1/repository/semantic-model?limit=1", {
        headers: {
          "X-StorageAPI-Token": tokenValue,
          Accept: "application/json",
        },
      });
      if (resp.status === 401) {
        setError("Invalid token. Ensure it's a Storage API token for the correct project.");
        setLoading(false);
        return;
      }
      if (!resp.ok) {
        setError(`API error: ${resp.status}`);
        setLoading(false);
        return;
      }
      onLogin();
    } catch (err) {
      setError("Failed to connect to metastore. Check your network.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md border border-border rounded-lg p-8 space-y-4"
      >
        <div>
          <h1 className="text-xl font-semibold">Semantic Layer Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your Keboola Storage API token to connect to the metastore.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1.5">
            Storage API Token
          </label>
          <input
            type="password"
            value={tokenValue}
            onChange={(e) => setTokenValue(e.target.value)}
            placeholder="xxxx-xxxxxxx-xxxxx..."
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !tokenValue}
          className="w-full px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Connecting..." : "Connect"}
        </button>

        <p className="text-[11px] text-muted-foreground text-center">
          Connects to metastore.us-east4.gcp.keboola.com
        </p>
      </form>
    </div>
  );
}

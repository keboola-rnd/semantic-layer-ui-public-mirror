import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
let multer, introspectProject, fetchTableDetails, classifyTables, enrichFromFile;
try {
  multer = (await import("multer")).default;
  ({ introspectProject, fetchTableDetails } = await import("./backend/introspect.js"));
  let testApiKey;
  ({ classifyTables, enrichFromFile, testApiKey } = await import("./backend/classify.js"));
  globalThis._testApiKey = testApiKey;
  console.log("[init] Backend modules loaded successfully");
} catch (err) {
  console.error("[init] Failed to load backend modules:", err.message);
  console.error("[init] AI features will be unavailable");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer
  ? multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })
  : null;

app.use(express.json({ limit: "10mb" }));

// Env vars
const METASTORE_URL =
  (process.env.METASTORE_URL || "https://metastore.us-east4.gcp.keboola.com").trim();
const KBC_TOKEN = (process.env.KBC_METASTORE_TOKEN || process.env.KBC_TOKEN || "").trim();

// ─── Health & Auth ───────────────────────────────────────────────────────────

app.get("/health", (_req, res) =>
  res.json({
    status: "ok",
    metastoreUrl: METASTORE_URL,
    hasToken: !!KBC_TOKEN,
    tokenPrefix: KBC_TOKEN ? KBC_TOKEN.substring(0, 8) + "..." : "none",
    hasAnthropicKey: !!(process.env.ANTHROPIC_API_KEY || "").trim(),
  })
);

// Test AI connectivity
app.get("/backend/test-ai", async (_req, res) => {
  if (globalThis._testApiKey) {
    const result = await globalThis._testApiKey();
    res.json(result);
  } else {
    res.json({ ok: false, error: "AI module not loaded" });
  }
});

app.all("/auth/status", (_req, res) => {
  res.json({ authenticated: !!KBC_TOKEN, metastoreUrl: METASTORE_URL });
});

// ─── Backend: Introspect ─────────────────────────────────────────────────────

app.post("/backend/introspect", async (req, res) => {
  try {
    const result = await introspectProject({
      token: KBC_TOKEN,
      storageUrl: req.body.storageUrl,
    });
    res.json(result);
  } catch (err) {
    console.error("[introspect] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/backend/introspect/tables", async (req, res) => {
  try {
    const { tableIds, storageUrl } = req.body;
    const tables = await fetchTableDetails(tableIds, {
      token: KBC_TOKEN,
      storageUrl,
    });
    res.json(tables);
  } catch (err) {
    console.error("[introspect/tables] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Backend: AI Classify (async with polling) ──────────────────────────────

const classifyJobs = new Map(); // jobId → { status, result, error }

app.post("/backend/classify", async (req, res) => {
  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  classifyJobs.set(jobId, { status: "running" });

  // Return immediately with job ID
  res.json({ jobId });

  // Run classification in background
  try {
    const { tables, projectName, sqlDialect } = req.body;
    const result = await classifyTables(tables, { projectName, sqlDialect });
    classifyJobs.set(jobId, { status: "done", result });
  } catch (err) {
    console.error("[classify] Error:", err.message);
    classifyJobs.set(jobId, { status: "error", error: err.message });
  }

  // Clean up old jobs after 10 minutes
  setTimeout(() => classifyJobs.delete(jobId), 600_000);
});

app.get("/backend/classify/:jobId", (req, res) => {
  const job = classifyJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// ─── Backend: File Upload & Enrichment ───────────────────────────────────────

app.post("/backend/upload", ...(upload ? [upload.single("file")] : []), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileContent = req.file.buffer.toString("utf-8");
    const fileName = req.file.originalname;
    const modelContext = req.body.modelContext
      ? JSON.parse(req.body.modelContext)
      : {};

    const result = await enrichFromFile(fileContent, fileName, modelContext);
    res.json(result);
  } catch (err) {
    console.error("[upload] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Backend: Create Model ───────────────────────────────────────────────────

app.post("/backend/create-model", async (req, res) => {
  try {
    const { model, datasets, metrics, relationships, glossary } = req.body;
    const headers = {
      "X-StorageAPI-Token": KBC_TOKEN,
      "Content-Type": "application/json",
    };

    const created = { datasets: 0, metrics: 0, relationships: 0, glossary: 0 };
    const errors = [];

    // 1. Create the model
    const modelResp = await fetch(`${METASTORE_URL}/api/v1/repository/semantic-model`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: model.name,
        data: model,
        branch: "main",
        schemaVersion: "1.0.0",
        scope: "project",
      }),
    });

    if (!modelResp.ok) {
      const errText = await modelResp.text();
      throw new Error(`Failed to create model: ${modelResp.status} ${errText}`);
    }

    const modelBody = await modelResp.json();
    const modelUUID = modelBody.data?.id || modelBody.id;
    console.log(`[create-model] Created model: ${model.name} (${modelUUID})`);

    // 2. Validate datasets — ensure required fields exist
    const validatedDatasets = (datasets || []).map((ds) => {
      const d = { ...ds };
      // Required: tableId, name, fqn, modelUUID
      if (!d.tableId) {
        console.warn(`[create-model] Dataset "${d.name}" missing tableId — skipping`);
        return null;
      }
      if (!d.fqn) {
        // Generate a placeholder FQN from tableId
        d.fqn = `"KEBOOLA"."${d.tableId.replace(/\./g, '"."')}"`;
      }
      if (!d.name) d.name = d.tableId.split(".").pop() || "unnamed";
      // Remove any extra fields that could cause 422
      delete d.accepted;
      return d;
    }).filter(Boolean);

    console.log(`[create-model] ${validatedDatasets.length}/${(datasets||[]).length} datasets valid`);

    // 3. Create child objects
    const childTypes = [
      { type: "semantic-dataset", items: validatedDatasets, key: "datasets", nameField: "name" },
      { type: "semantic-metric", items: metrics || [], key: "metrics", nameField: "name" },
      { type: "semantic-relationship", items: relationships || [], key: "relationships", nameField: "name" },
      { type: "semantic-glossary", items: glossary || [], key: "glossary", nameField: "term" },
    ];

    for (const { type, items, key, nameField } of childTypes) {
      for (const item of items) {
        // Clean up: remove non-schema fields
        const data = { ...item, modelUUID };
        delete data.accepted;
        const name = item[nameField] || item.tableId || "unnamed";

        try {
          const resp = await fetch(`${METASTORE_URL}/api/v1/repository/${type}`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              name,
              data,
              branch: "main",
              schemaVersion: "1.0.0",
              scope: "project",
            }),
          });

          if (resp.ok) {
            created[key]++;
          } else {
            const errText = await resp.text();
            errors.push({ type, name, status: resp.status, error: errText.substring(0, 200) });
            console.error(`[create-model] Failed ${type}/${name}: ${resp.status} — ${errText.substring(0, 300)}`);
          }
        } catch (err) {
          errors.push({ type, name, error: err.message });
        }
      }
    }

    console.log(`[create-model] Done: ${JSON.stringify(created)}, ${errors.length} errors`);
    res.json({ modelUUID, modelName: model.name, created, errors });
  } catch (err) {
    console.error("[create-model] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Metastore Proxy ─────────────────────────────────────────────────────────

app.use(
  createProxyMiddleware({
    target: METASTORE_URL,
    changeOrigin: true,
    pathFilter: "/api",
    on: {
      proxyReq: (proxyReq) => {
        if (KBC_TOKEN) proxyReq.setHeader("X-StorageAPI-Token", KBC_TOKEN);
      },
      proxyRes: (proxyRes, req) => {
        if (proxyRes.statusCode >= 400) {
          console.log(`[proxy] ${req.method} ${req.url} → ${proxyRes.statusCode}`);
        }
      },
      error: (err, req, res) => {
        console.error(`[proxy error] ${req.method} ${req.url}:`, err.message);
        if (res.writeHead) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Proxy error", message: err.message }));
        }
      },
    },
  })
);

// ─── Static + SPA ────────────────────────────────────────────────────────────

app.use(express.static(join(__dirname, "dist"), { index: false }));
app.all("/{*path}", (_req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Metastore UI server running on port ${PORT}`);
  console.log(`Proxying /api/* → ${METASTORE_URL}`);
  console.log(`Auth: ${KBC_TOKEN ? `token (${KBC_TOKEN.substring(0, 8)}...)` : "no token"}`);
  console.log(`AI: ${(process.env.ANTHROPIC_API_KEY || "").trim() ? "Anthropic API key present" : "no API key"}`);
});

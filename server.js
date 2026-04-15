import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
let multer, introspectProject, fetchTableDetails, fetchTransformations, classifyTables, enrichFromFile, testApiKey;
let buildSkeleton, suggestBasicMetrics, suggestRelationships;
let callClaude, parseJSON;
try {
  multer = (await import("multer")).default;
  ({ introspectProject, fetchTableDetails, fetchTransformations } = await import("./backend/introspect.js"));
  ({ classifyTables, enrichFromFile, testApiKey, callClaude, parseJSON } = await import("./backend/classify.js"));
  ({ buildSkeleton, suggestBasicMetrics, suggestRelationships } = await import("./backend/heuristic.js"));
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

// ─── Backend: Skeleton (heuristic, instant) ──────────────────────────────────

app.post("/backend/skeleton", async (req, res) => {
  try {
    const { tableIds, storageUrl } = req.body;
    const tables = await fetchTableDetails(tableIds, { token: KBC_TOKEN, storageUrl });
    const datasets = buildSkeleton(tables);
    const metrics = suggestBasicMetrics(datasets);
    const relationships = suggestRelationships(datasets);
    console.log(`[skeleton] ${datasets.length} datasets, ${metrics.length} metrics, ${relationships.length} relationships`);
    res.json({ datasets, metrics, relationships, tables });
  } catch (err) {
    console.error("[skeleton] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Backend: AI Classify Streaming (parallel per-table, dataset-only) ──────

const ENHANCE_PROMPT = `Enhance this dataset for a semantic layer. Classify each column:
- role: key/dimension/measure/timestamp
- type: string/integer/decimal/boolean/date/datetime/json
Add a short description for the table and each column. Keep descriptions SHORT (1 sentence).
CRITICAL: Include the exact "tableId" from the input. Copy it exactly.
Respond with ONLY valid JSON:
{"tableId":"exact.table.id","name":"table","description":"...","grain":"...","primaryKey":["col"],"fields":[{"name":"col","role":"key","type":"string","description":"..."}]}`;

const streamJobs = new Map();

app.post("/backend/classify-stream", async (req, res) => {
  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const { tables, projectName, sqlDialect } = req.body;
  const tableEntries = Object.entries(tables);

  streamJobs.set(jobId, {
    status: "running",
    completed: [],
    completedCount: 0,
    totalCount: tableEntries.length,
  });

  res.json({ jobId, totalCount: tableEntries.length });

  // Process ALL tables in parallel with auto-retry
  async function enhanceTable(tableId, table, attempt = 0) {
    const MAX_RETRIES = 2;
    try {
      const tableSchema = {
        tableId,
        name: table.name,
        description: table.description || "",
        primaryKey: table.primaryKey || [],
        columns: (table.columns || []).map((c) => ({
          name: c.name,
          nativeType: c.nativeType || c.baseType || "VARCHAR",
          description: c.description || "",
        })),
      };

      const prompt = `${ENHANCE_PROMPT}\n\nProject: ${projectName || "Unknown"}, SQL: ${sqlDialect || "Snowflake"}\n\nTable:\n${JSON.stringify(tableSchema)}`;
      // Scale max_tokens based on column count — large tables need more output tokens
      const maxTokens = Math.min(8192, Math.max(2048, tableSchema.columns.length * 80));
      const text = await callClaude(prompt, maxTokens);
      const dataset = parseJSON(text);

      if (!dataset.tableId) dataset.tableId = tableId;

      const job = streamJobs.get(jobId);
      if (job) {
        job.completed.push({ tableId, dataset, metrics: [], relationships: [], glossary: [] });
        job.completedCount = job.completed.length;
      }
      console.log(`[classify-stream] ✓ ${tableId} (${job?.completedCount}/${tableEntries.length})`);
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.warn(`[classify-stream] ✗ ${tableId} (attempt ${attempt + 1}), retrying...`);
        await new Promise((r) => setTimeout(r, 500));
        return enhanceTable(tableId, table, attempt + 1);
      }
      console.error(`[classify-stream] ✗ ${tableId} failed after ${MAX_RETRIES + 1} attempts:`, err.message);
      const job = streamJobs.get(jobId);
      if (job) {
        job.completedCount++;
        if (!job.warnings) job.warnings = [];
        job.warnings.push(`${tableId}: enhancement failed — using heuristic classification`);
      }
    }
  }

  const promises = tableEntries.map(([tableId, table]) => enhanceTable(tableId, table));

  await Promise.allSettled(promises);

  const job = streamJobs.get(jobId);
  if (job) job.status = "done";
  setTimeout(() => streamJobs.delete(jobId), 600_000);
});

app.get("/backend/classify-stream/:jobId", (req, res) => {
  const job = streamJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// ─── Backend: Step-by-step AI suggestions ───────────────────────────────────

// ── Future metric generation approaches (documented ideas) ──────────────────
//
// IDEA 1 — Keboola MCP Server agent:
//   Give the AI agent the Keboola MCP server (which already has tools like get_components,
//   get_configs, query_data, etc.) and let it autonomously explore the project's SQL
//   transformations to build metrics. The agent would:
//   1. Browse all transformation components and configs via MCP tool calls
//   2. Understand the full SQL transformation graph (inputs → SQL → outputs)
//   3. Discover business-critical aggregations, calculated fields, and KPIs
//   4. Generate metrics that mirror the existing business logic
//   The current approach (fetchTransformations + prompt) is a stopgap for this.
//
// IDEA 2 — Padak's new CLI + master token for org-wide semantic layers:
//   Use the new Keboola CLI (kbagent/kbc) with a master token to pull ALL projects in an
//   org. Build an agent on top of the CLI's project representation that can:
//   1. List all projects in the org via master token
//   2. For each project, use the CLI to get a structured view of components, transformations,
//      buckets, and tables — the CLI already represents these as a navigable tree
//   3. Run an agent loop that reads transformation SQL across projects to find shared
//      business logic (e.g., the same "revenue" calculation in multiple projects)
//   4. Build an org-wide semantic layer by unifying metrics across projects
//   This would enable multi-project semantic models where a single org model references
//   tables and metrics from many projects with consistent naming and definitions.
//
app.post("/backend/suggest-metrics", async (req, res) => {
  try {
    const { datasets, projectName, sqlDialect, storageUrl } = req.body;
    const dsInfo = (datasets || []).map((d) => ({
      tableId: d.tableId, name: d.name,
      description: d.description || "",
      fields: (d.fields || []).map((f) => ({ name: f.name, role: f.role, type: f.type, description: f.description || "" })),
    }));

    // Fetch SQL transformations from the project to inform metric generation
    let transformationContext = "";
    let txCount = 0;
    if (fetchTransformations) {
      try {
        console.log("[suggest-metrics] Fetching SQL transformations for context...");
        const txResult = await fetchTransformations({ token: KBC_TOKEN, storageUrl: storageUrl || undefined });
        if (txResult.transformations.length > 0) {
          const sqlSummary = txResult.transformations
            .filter((t) => t.queries.length > 0)
            .slice(0, 20)
            .map((t) => ({
              name: t.configName,
              inputTables: t.inputMappings.map((m) => m.source),
              outputTables: t.outputMappings.map((m) => m.destination),
              sql: t.queries.map((q) => q.sql).join("\n").substring(0, 3000),
            }));
          if (sqlSummary.length > 0) {
            txCount = sqlSummary.length;
            transformationContext = `\n\nCRITICAL CONTEXT — Existing SQL transformations from this project. These contain the REAL business logic and calculations that the organization already uses. Extract metrics from these queries:\n${JSON.stringify(sqlSummary, null, 2)}`;
            console.log(`[suggest-metrics] Found ${sqlSummary.length} transformations with SQL`);
          }
        }
      } catch (err) {
        console.warn("[suggest-metrics] Could not fetch transformations:", err.message);
      }
    }

    const prompt = `You are building a semantic layer for a ${sqlDialect || "Snowflake"} data warehouse.
Your job is to define CONCRETE, EXECUTABLE SQL metrics for these datasets.

RULES:
- Every metric MUST have a valid SQL expression using real column names from the datasets below.
- Use double-quoted column names: SUM("total_tokens"), COUNT(DISTINCT "conversation_id"), etc.
- The "dataset" field MUST be an exact tableId from the list (e.g. "in.c-bucket.table").
- Name metrics in snake_case. Make names specific (e.g. "avg_conversation_duration_seconds" not "avg_duration").
- Focus on metrics a data analyst would actually use. Think: KPIs, rates, averages, totals, counts.
- DO NOT use placeholder column names. Only reference columns that actually exist in the datasets.
- Every metric needs a clear 1-sentence description of what it measures and why it matters.
${transformationContext ? `\n${transformationContext}` : ""}

DATASETS (with their actual columns):
${JSON.stringify(dsInfo, null, 2)}

Respond with ONLY valid JSON: {"metrics":[{"name":"...","sql":"SUM(\\"real_column\\")","dataset":"in.c-bucket.table","description":"..."}]}`;

    const text = await callClaude(prompt, 8192);
    const result = parseJSON(text);
    const metrics = (result.metrics || []).filter((m) => m.name && m.sql && m.dataset);
    console.log(`[suggest-metrics] Generated ${metrics.length} metrics (${txCount} transformations used as context)`);
    res.json({ metrics });
  } catch (err) {
    console.error("[suggest-metrics] Error:", err.message);
    res.status(500).json({ error: err.message, metrics: [] });
  }
});

app.post("/backend/suggest-relationships", async (req, res) => {
  try {
    const { datasets, sqlDialect } = req.body;
    const dsInfo = (datasets || []).map((d) => ({
      tableId: d.tableId, name: d.name, fields: (d.fields || []).filter((f) => f.role === "key").map((f) => f.name),
    }));
    const prompt = `Suggest JOIN relationships between these datasets for a ${sqlDialect || "Snowflake"} semantic layer.
For each: name (snake_case), from (tableId), to (tableId), on (join condition using from."col" = to."col"), type (left or inner).
Only suggest relationships where columns clearly match.
Respond with ONLY valid JSON: {"relationships":[{"name":"...","from":"...","to":"...","on":"...","type":"left"}]}

Datasets:\n${JSON.stringify(dsInfo)}`;
    const text = await callClaude(prompt, 2048);
    const result = parseJSON(text);
    res.json({ relationships: result.relationships || [] });
  } catch (err) {
    console.error("[suggest-relationships] Error:", err.message);
    res.status(500).json({ error: err.message, relationships: [] });
  }
});

app.post("/backend/suggest-glossary", async (req, res) => {
  try {
    const { datasets, metrics, projectName } = req.body;
    const dsNames = (datasets || []).map((d) => ({ tableId: d.tableId, name: d.name, description: d.description }));
    const metNames = (metrics || []).map((m) => ({ name: m.name, description: m.description }));
    console.log(`[suggest-glossary] Generating for ${dsNames.length} datasets, ${metNames.length} metrics`);
    const prompt = `Define business glossary terms for the "${projectName || "Unknown"}" project's semantic layer.

These terms should help non-technical users understand the data. Look at the dataset names, column themes, and metric names to identify the key business concepts.

RULES:
- Each term should be a concrete business concept (e.g. "Conversation", "Token Usage", "Task Success Rate")
- Definitions should be 1-2 sentences explaining what the concept means in THIS project's context
- seeAlso should reference actual tableIds from the list below
- Generate 5-15 terms covering the main business domains in this data

Respond with ONLY valid JSON: {"glossary":[{"term":"...","definition":"...","seeAlso":["in.c-bucket.table"]}]}

Datasets: ${JSON.stringify(dsNames)}
Metrics: ${JSON.stringify(metNames)}`;
    const text = await callClaude(prompt, 4096);
    const result = parseJSON(text);
    console.log(`[suggest-glossary] Generated ${result.glossary?.length || 0} terms`);
    res.json({ glossary: result.glossary || [] });
  } catch (err) {
    console.error("[suggest-glossary] Error:", err.message);
    res.status(500).json({ error: err.message, glossary: [] });
  }
});

app.post("/backend/suggest-constraints", async (req, res) => {
  try {
    const { metrics, datasets } = req.body;
    const metNames = (metrics || []).map((m) => ({ name: m.name, sql: m.sql, description: m.description }));
    console.log(`[suggest-constraints] Generating for ${metNames.length} metrics`);

    if (metNames.length === 0) {
      console.warn("[suggest-constraints] No metrics provided, skipping");
      return res.json({ constraints: [] });
    }

    const prompt = `Define business rule constraints that validate relationships between these metrics.

RULES:
- name: snake_case matching ^[a-z][a-z0-9_]*$ (e.g. "token_count_non_negative")
- constraintType: one of inequality, equality, range, composition, exclusion, temporal, conditional
- rule: human-readable rule description (e.g. "total_tokens >= 0")
- metrics: array of metric names from the list below that this constraint validates (min 1)
- description: why this constraint matters
- severity: error (data is wrong), warning (suspicious), or info (best practice)

Generate 3-8 practical constraints. Focus on:
- Non-negative values for counts and totals (inequality)
- Reasonable ranges for rates and averages (range)
- Logical relationships between related metrics (composition)

Respond with ONLY valid JSON: {"constraints":[{"name":"...","constraintType":"...","rule":"...","metrics":["..."],"description":"...","severity":"warning"}]}

Available metrics:
${JSON.stringify(metNames, null, 2)}`;

    const text = await callClaude(prompt, 4096);
    const result = parseJSON(text);
    console.log(`[suggest-constraints] Generated ${result.constraints?.length || 0} constraints`);
    res.json({ constraints: result.constraints || [] });
  } catch (err) {
    console.error("[suggest-constraints] Error:", err.message);
    res.status(500).json({ error: err.message, constraints: [] });
  }
});

app.post("/backend/generate-description", async (req, res) => {
  try {
    const { modelName, datasets, metrics } = req.body;
    const prompt = `Write a 1-2 sentence description for a semantic model called "${modelName}".
It contains these datasets: ${(datasets || []).map((d) => d.name).join(", ")}.
And these metrics: ${(metrics || []).slice(0, 10).map((m) => m.name).join(", ")}.
Respond with ONLY the description text, no quotes or JSON.`;
    const text = await callClaude(prompt, 256);
    res.json({ description: text.trim().replace(/^["']|["']$/g, "") });
  } catch (err) {
    console.error("[generate-description] Error:", err.message);
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

// ─── Schema validation & auto-fix ───────────────────────────────────────────

const VALID_FIELD_ROLES = new Set(["key", "dimension", "measure", "timestamp"]);
const VALID_FIELD_TYPES = new Set(["string", "integer", "decimal", "boolean", "date", "datetime", "json"]);
const VALID_JOIN_TYPES = new Set(["left", "inner"]);
const VALID_CONSTRAINT_TYPES = new Set(["inequality", "equality", "range", "composition", "exclusion", "temporal", "conditional"]);
const VALID_SEVERITY = new Set(["error", "warning", "info"]);

// Fields allowed per schema (for stripping extras)
const ALLOWED_FIELDS = {
  "semantic-dataset": new Set(["modelUUID", "tableId", "name", "description", "fqn", "grain", "primaryKey", "fields", "ai"]),
  "semantic-metric": new Set(["modelUUID", "name", "description", "sql", "dataset"]),
  "semantic-relationship": new Set(["modelUUID", "name", "from", "to", "on", "type"]),
  "semantic-glossary": new Set(["modelUUID", "term", "definition", "seeAlso"]),
  "semantic-constraint": new Set([
    "modelUUID", "name", "displayName", "description", "constraintType", "metrics",
    "datasets", "rule", "ruleExpression", "validationQuery", "severity",
    "errorMessage", "remediation", "isActive", "scope", "owner", "tags", "ai",
  ]),
};

function validateAndFix(type, data) {
  const d = { ...data };
  const errors = [];

  // Strip non-schema fields
  const allowed = ALLOWED_FIELDS[type];
  if (allowed) {
    for (const key of Object.keys(d)) {
      if (!allowed.has(key)) {
        delete d[key];
      }
    }
  }

  // Always remove UI-only fields
  delete d.accepted;
  delete d._heuristic;
  delete d._aiEnhanced;

  switch (type) {
    case "semantic-dataset": {
      if (!d.tableId) { errors.push("missing tableId"); break; }
      if (!d.name) d.name = d.tableId.split(".").pop() || "unnamed";
      if (!d.fqn) d.fqn = `"KEBOOLA"."${d.tableId.replace(/\./g, '"."')}"`;
      // Validate fields
      if (Array.isArray(d.fields)) {
        d.fields = d.fields.map((f) => {
          const fixed = { ...f };
          if (fixed.role && !VALID_FIELD_ROLES.has(fixed.role)) fixed.role = "dimension";
          if (fixed.type && !VALID_FIELD_TYPES.has(fixed.type)) fixed.type = "string";
          return fixed;
        });
      }
      break;
    }
    case "semantic-metric": {
      if (!d.name) errors.push("missing name");
      if (!d.sql) errors.push("missing sql");
      break;
    }
    case "semantic-relationship": {
      if (!d.from) errors.push("missing from");
      if (!d.to) errors.push("missing to");
      if (!d.on) errors.push("missing on");
      if (d.type && !VALID_JOIN_TYPES.has(d.type)) d.type = "left";
      break;
    }
    case "semantic-glossary": {
      if (!d.term) errors.push("missing term");
      if (!d.definition) errors.push("missing definition");
      if (d.seeAlso && !Array.isArray(d.seeAlso)) d.seeAlso = [];
      break;
    }
    case "semantic-constraint": {
      if (!d.name) errors.push("missing name");
      if (!d.constraintType) errors.push("missing constraintType");
      else if (!VALID_CONSTRAINT_TYPES.has(d.constraintType)) d.constraintType = "inequality";
      if (!d.rule) errors.push("missing rule");
      if (!d.metrics || !Array.isArray(d.metrics) || d.metrics.length === 0) errors.push("missing metrics (need at least 1)");
      if (d.severity && !VALID_SEVERITY.has(d.severity)) d.severity = "warning";
      // Enforce name pattern
      if (d.name && !/^[a-z][a-z0-9_]*$/.test(d.name)) {
        d.name = d.name.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^[^a-z]+/, "c_");
      }
      break;
    }
  }

  return { data: d, errors };
}

async function repairWithLLM(type, items, allErrors) {
  if (!callClaude || !parseJSON) return items; // No AI available
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) return items;

  console.log(`[repair] Asking LLM to fix ${allErrors.length} objects of type ${type}...`);

  const errorSummary = allErrors.map((e) => `Object "${e.name}": ${e.errors.join(", ")}`).join("\n");

  const prompt = `Fix these ${type} objects for a semantic layer metastore. Each has validation errors.

ERRORS:
${errorSummary}

OBJECTS TO FIX:
${JSON.stringify(allErrors.map((e) => e.original), null, 2)}

RULES:
- semantic-metric requires: name (string), sql (SQL expression like SUM("col")), modelUUID (keep as-is)
- semantic-relationship requires: from (tableId), to (tableId), on (join condition), type must be "left" or "inner"
- semantic-glossary requires: term (string), definition (string)
- semantic-constraint requires: name (snake_case matching ^[a-z][a-z0-9_]*$), constraintType (one of: inequality,equality,range,composition,exclusion,temporal,conditional), rule (string), metrics (array of metric names, min 1)
- For metrics: sql should be an aggregate like SUM("column"), COUNT(*), AVG("column"), etc.
- Keep the semantic meaning — just fix the structure to be valid.

Return ONLY a JSON array of the fixed objects. Keep modelUUID fields as-is.`;

  try {
    const text = await callClaude(prompt, 4096);
    const fixed = parseJSON(text);
    if (Array.isArray(fixed) && fixed.length > 0) {
      console.log(`[repair] LLM returned ${fixed.length} fixed objects`);
      return fixed;
    }
  } catch (err) {
    console.error(`[repair] LLM repair failed:`, err.message);
  }
  return [];
}

// ─── Backend: Create Model ───────────────────────────────────────────────────

app.post("/backend/create-model", async (req, res) => {
  try {
    const { model, datasets, metrics, relationships, glossary, constraints } = req.body;
    const headers = {
      "X-StorageAPI-Token": KBC_TOKEN,
      "Content-Type": "application/json",
    };

    const created = { datasets: 0, metrics: 0, relationships: 0, glossary: 0, constraints: 0 };
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

    // 2. Validate & fix all child objects
    const childTypes = [
      { type: "semantic-dataset", items: datasets || [], key: "datasets", nameField: "name" },
      { type: "semantic-metric", items: metrics || [], key: "metrics", nameField: "name" },
      { type: "semantic-relationship", items: relationships || [], key: "relationships", nameField: "name" },
      { type: "semantic-glossary", items: glossary || [], key: "glossary", nameField: "term" },
      { type: "semantic-constraint", items: constraints || [], key: "constraints", nameField: "name" },
    ];

    for (const { type, items, key, nameField } of childTypes) {
      // Phase 1: Validate and auto-fix
      const valid = [];
      const needsRepair = [];

      for (const item of items) {
        const { data: fixed, errors: validationErrors } = validateAndFix(type, { ...item, modelUUID });

        if (validationErrors.length === 0) {
          valid.push(fixed);
        } else {
          needsRepair.push({ original: item, name: item[nameField] || "unnamed", errors: validationErrors });
          console.warn(`[create-model] ${type}/${item[nameField] || "?"}: ${validationErrors.join(", ")}`);
        }
      }

      // Phase 2: LLM repair for invalid objects
      if (needsRepair.length > 0) {
        const repaired = await repairWithLLM(type, items, needsRepair);
        for (const obj of repaired) {
          const { data: fixed, errors: reErrors } = validateAndFix(type, { ...obj, modelUUID });
          if (reErrors.length === 0) {
            valid.push(fixed);
            console.log(`[create-model] LLM repaired ${type}/${fixed[nameField] || "?"}`);
          } else {
            console.warn(`[create-model] LLM repair still invalid: ${type}/${obj[nameField] || "?"}: ${reErrors.join(", ")}`);
          }
        }
      }

      console.log(`[create-model] ${type}: ${valid.length} valid (${items.length} input, ${needsRepair.length} needed repair)`);

      // Phase 3: Create in metastore with retry on duplicate names
      for (const data of valid) {
        const name = data[nameField] || data.tableId || "unnamed";

        for (let attempt = 0; attempt < 2; attempt++) {
          const useName = attempt === 0 ? name : `${name}_${Date.now().toString(36)}`;
          try {
            const resp = await fetch(`${METASTORE_URL}/api/v1/repository/${type}`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                name: useName,
                data: attempt > 0 ? { ...data, name: useName } : data,
                branch: "main",
                schemaVersion: "1.0.0",
                scope: "project",
              }),
            });

            if (resp.ok) {
              created[key]++;
              break;
            }

            const errText = await resp.text();

            // 500 = likely duplicate name, retry with unique suffix
            if (resp.status === 500 && attempt === 0) {
              console.warn(`[create-model] ${type}/${name}: 500 (duplicate?), retrying with unique name`);
              continue;
            }

            errors.push({ type, name: useName, status: resp.status, error: errText.substring(0, 200) });
            console.error(`[create-model] Failed ${type}/${useName}: ${resp.status} — ${errText.substring(0, 300)}`);
            break;
          } catch (err) {
            errors.push({ type, name, error: err.message });
            break;
          }
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

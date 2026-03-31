/**
 * AI-assisted classification of table schemas using Claude.
 * Classifies fields, suggests metrics, relationships, and glossary terms.
 * Handles large table counts by batching.
 */

import Anthropic from "@anthropic-ai/sdk";

const getClient = () => {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
};

const CLASSIFICATION_PROMPT = `You are a data analyst building a semantic layer for a Keboola data warehouse.

Given the following table schemas, produce a semantic layer in JSON.

For each table, classify every column:
- role: "key" (primary/foreign keys, columns ending in _id), "dimension" (categorical/descriptive), "measure" (numeric values for aggregation), "timestamp" (dates/times)
- type: "string", "integer", "decimal", "boolean", "date", "datetime", "json"

Also generate:
- metrics: SQL aggregation expressions for measure columns (Snowflake syntax, double-quoted column names)
- relationships: JOIN conditions between tables based on matching column names
- glossary: Business term definitions for important concepts

Respond with ONLY valid JSON (no markdown fences, no explanation):
{"datasets":[...],"metrics":[...],"relationships":[...],"glossary":[...]}`;

const BATCH_SIZE = 25; // tables per Claude call

async function classifyBatch(client, tableSchemas, projectContext) {
  const userMessage = `Project: ${projectContext.projectName || "Unknown"}
SQL Dialect: ${projectContext.sqlDialect || "Snowflake"}

Tables (${tableSchemas.length}):
${JSON.stringify(tableSchemas, null, 2)}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 64000,
    messages: [
      { role: "user", content: CLASSIFICATION_PROMPT + "\n\n" + userMessage },
    ],
  });

  const text = response.content[0]?.text || "";

  // Extract JSON — handle markdown fences or raw JSON
  let jsonStr = text.trim();
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  // Find the JSON object boundaries
  const firstBrace = jsonStr.indexOf("{");
  if (firstBrace > 0) jsonStr = jsonStr.substring(firstBrace);

  return JSON.parse(jsonStr);
}

export async function classifyTables(tables, projectContext = {}) {
  const client = getClient();

  const tableSchemas = Object.entries(tables).map(([tableId, t]) => ({
    tableId,
    name: t.name,
    description: t.description || "",
    primaryKey: t.primaryKey || [],
    columns: (t.columns || []).map((c) => ({
      name: c.name,
      nativeType: c.nativeType || c.baseType || "VARCHAR",
      description: c.description || "",
    })),
  }));

  // Batch tables to avoid output truncation
  const batches = [];
  for (let i = 0; i < tableSchemas.length; i += BATCH_SIZE) {
    batches.push(tableSchemas.slice(i, i + BATCH_SIZE));
  }

  console.log(
    `[classify] Classifying ${tableSchemas.length} tables in ${batches.length} batch(es) of up to ${BATCH_SIZE}...`
  );

  const merged = { datasets: [], metrics: [], relationships: [], glossary: [] };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`[classify]   Batch ${i + 1}/${batches.length} (${batch.length} tables)...`);

    try {
      const result = await classifyBatch(client, batch, projectContext);
      if (result.datasets) merged.datasets.push(...result.datasets);
      if (result.metrics) merged.metrics.push(...result.metrics);
      if (result.relationships) merged.relationships.push(...result.relationships);
      if (result.glossary) merged.glossary.push(...result.glossary);
    } catch (err) {
      console.error(`[classify]   Batch ${i + 1} failed:`, err.message);
      // Continue with other batches
    }
  }

  // If multiple batches, do a follow-up call to find cross-batch relationships
  if (batches.length > 1) {
    console.log(`[classify] Finding cross-batch relationships...`);
    try {
      const allTableIds = tableSchemas.map((t) => ({
        tableId: t.tableId,
        name: t.name,
        columns: t.columns.map((c) => c.name),
      }));

      const crossResponse = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: `Given these tables, suggest JOIN relationships between them based on matching column names. Respond with ONLY a JSON array of relationships:
[{"name":"from_to_to","from":"from.table.id","to":"to.table.id","on":"from.\\"col\\" = to.\\"col\\"","type":"left"}]

Tables: ${JSON.stringify(allTableIds)}`,
          },
        ],
      });

      const crossText = crossResponse.content[0]?.text || "";
      let crossJson = crossText.trim();
      const crossMatch = crossText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (crossMatch) crossJson = crossMatch[1].trim();
      const firstBracket = crossJson.indexOf("[");
      if (firstBracket > 0) crossJson = crossJson.substring(firstBracket);

      const crossRels = JSON.parse(crossJson);
      // Add only relationships not already found
      const existingKeys = new Set(
        merged.relationships.map((r) => `${r.from}|${r.to}`)
      );
      for (const r of crossRels) {
        if (!existingKeys.has(`${r.from}|${r.to}`)) {
          merged.relationships.push(r);
        }
      }
    } catch (err) {
      console.error(`[classify] Cross-batch relationship detection failed:`, err.message);
    }
  }

  console.log(
    `[classify] Total: ${merged.datasets.length} datasets, ${merged.metrics.length} metrics, ${merged.relationships.length} relationships, ${merged.glossary.length} glossary`
  );

  return merged;
}

const FILE_ENRICHMENT_PROMPT = `You are enriching a semantic layer with information from uploaded documentation.

Current semantic layer state:
{MODEL_CONTEXT}

Document content:
{DOCUMENT_CONTENT}

Extract and suggest additions. Respond with ONLY valid JSON (no markdown fences):
{"suggestedMetrics":[],"suggestedGlossary":[],"fieldUpdates":[],"suggestedRelationships":[]}`;

export async function enrichFromFile(fileContent, fileName, modelContext) {
  const client = getClient();

  const prompt = FILE_ENRICHMENT_PROMPT.replace(
    "{MODEL_CONTEXT}",
    JSON.stringify(modelContext, null, 2)
  ).replace("{DOCUMENT_CONTENT}", fileContent);

  console.log(`[enrich] Processing file: ${fileName} (${fileContent.length} chars)`);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0]?.text || "";
  let jsonStr = text.trim();
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();
  const firstBrace = jsonStr.indexOf("{");
  if (firstBrace > 0) jsonStr = jsonStr.substring(firstBrace);

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("[enrich] Failed to parse response:", err.message);
    throw new Error("Failed to parse AI enrichment response");
  }
}

/**
 * AI-assisted classification of table schemas using Claude.
 * Classifies fields, suggests metrics, relationships, and glossary terms.
 */

import Anthropic from "@anthropic-ai/sdk";

const getClient = () => {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
};

const CLASSIFICATION_PROMPT = `You are a data analyst building a semantic layer for a Keboola data warehouse.

Given the following table schemas from a Keboola project, produce a complete semantic layer in JSON.

For each table, classify every column:
- role: "key" (primary/foreign keys), "dimension" (categorical/descriptive), "measure" (numeric values that should be aggregated), "timestamp" (dates/times)
- type: "string", "integer", "decimal", "boolean", "date", "datetime", "json"

Use the column's native database type and name to determine role and type. Columns named *_id or that are primary keys should be "key". Date/timestamp columns should be "timestamp". Numeric columns with names suggesting amounts/counts/values should be "measure". Everything else is "dimension".

Also generate:
- metrics: SQL aggregation expressions for important measure columns. Use Snowflake SQL syntax with double-quoted column names. Include a descriptive name, the SQL expression, the source dataset (tableId), and a description.
- relationships: JOIN conditions between tables. Look for matching column names across tables (e.g., company_id in both tables). Include from (tableId), to (tableId), the ON clause, join type ("left" or "inner"), and a descriptive name.
- glossary: Business term definitions for important concepts in the data. Include term, definition, and seeAlso (array of related tableIds).

Respond with ONLY valid JSON (no markdown, no explanation) in this exact structure:
{
  "datasets": [
    {
      "tableId": "the.table.id",
      "name": "table_name",
      "description": "what this table contains",
      "grain": "what one row represents",
      "primaryKey": ["col1"],
      "fields": [
        { "name": "col_name", "role": "dimension", "type": "string", "description": "what this column is" }
      ],
      "ai": { "keywords": ["relevant", "search", "terms"] }
    }
  ],
  "metrics": [
    {
      "name": "metric_name",
      "sql": "SUM(\\"column\\")",
      "dataset": "the.table.id",
      "description": "what this measures"
    }
  ],
  "relationships": [
    {
      "name": "from_to_to",
      "from": "from.table.id",
      "to": "to.table.id",
      "on": "from.\\"col\\" = to.\\"col\\"",
      "type": "left"
    }
  ],
  "glossary": [
    {
      "term": "Business Term",
      "definition": "What it means in business context",
      "seeAlso": ["related.table.id"]
    }
  ]
}`;

export async function classifyTables(tables, projectContext = {}) {
  const client = getClient();

  // Build table schema summary for the prompt
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

  const userMessage = `Project: ${projectContext.projectName || "Unknown"}
SQL Dialect: ${projectContext.sqlDialect || "Snowflake"}

Tables (${tableSchemas.length}):
${JSON.stringify(tableSchemas, null, 2)}`;

  console.log(
    `[classify] Sending ${tableSchemas.length} tables to Claude for classification...`
  );

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    messages: [
      { role: "user", content: CLASSIFICATION_PROMPT + "\n\n" + userMessage },
    ],
  });

  const text = response.content[0]?.text || "";

  // Extract JSON from response (handle potential markdown wrapping)
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  try {
    const result = JSON.parse(jsonStr.trim());
    console.log(
      `[classify] Got ${result.datasets?.length || 0} datasets, ${result.metrics?.length || 0} metrics, ${result.relationships?.length || 0} relationships, ${result.glossary?.length || 0} glossary terms`
    );
    return result;
  } catch (err) {
    console.error("[classify] Failed to parse Claude response:", err.message);
    console.error("[classify] Raw response:", text.substring(0, 500));
    throw new Error("Failed to parse AI classification response");
  }
}

const FILE_ENRICHMENT_PROMPT = `You are enriching a semantic layer with information from uploaded documentation.

Current semantic layer state:
{MODEL_CONTEXT}

Document content:
{DOCUMENT_CONTENT}

Based on the document, suggest additions and improvements to the semantic layer. Respond with ONLY valid JSON:
{
  "suggestedMetrics": [
    { "name": "metric_name", "sql": "SQL expression", "dataset": "table.id", "description": "what it measures" }
  ],
  "suggestedGlossary": [
    { "term": "Term", "definition": "Business definition", "seeAlso": ["table.id"] }
  ],
  "fieldUpdates": [
    { "tableId": "table.id", "fieldName": "column_name", "description": "improved description" }
  ],
  "suggestedRelationships": [
    { "name": "rel_name", "from": "from.table.id", "to": "to.table.id", "on": "join condition", "type": "left" }
  ]
}

Only suggest items that are clearly supported by the document. Reference exact table and column names from the current semantic layer.`;

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
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  try {
    return JSON.parse(jsonStr.trim());
  } catch (err) {
    console.error("[enrich] Failed to parse response:", err.message);
    throw new Error("Failed to parse AI enrichment response");
  }
}

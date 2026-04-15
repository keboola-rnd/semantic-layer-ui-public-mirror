/**
 * AI-assisted classification using Claude via direct HTTP (no SDK).
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export async function callClaude(prompt, maxTokens = 8192) {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set — add it as a data app secret");

  console.log(`[claude] Calling API (${prompt.length} chars, max_tokens=${maxTokens})...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2min timeout

  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const err = await resp.text();
      console.error(`[claude] API error ${resp.status}:`, err.substring(0, 300));
      throw new Error(`Anthropic API ${resp.status}: ${err.substring(0, 200)}`);
    }

    const body = await resp.json();
    const text = body.content?.[0]?.text || "";
    console.log(`[claude] Response OK (${text.length} chars, stop=${body.stop_reason})`);
    return text;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Anthropic API call timed out after 2 minutes");
    }
    throw err;
  }
}

/** Quick test that the API key works */
export async function testApiKey() {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY not set" };

  try {
    const resp = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "Say OK" }],
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      return { ok: false, error: `API returned ${resp.status}: ${err.substring(0, 100)}` };
    }
    const body = await resp.json();
    return { ok: true, response: body.content?.[0]?.text, model: body.model };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function parseJSON(text) {
  let s = text.trim();
  // Strip markdown fences
  const match = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) s = match[1].trim();
  // Find first { or [
  const braceIdx = s.indexOf("{");
  const bracketIdx = s.indexOf("[");
  const start = braceIdx >= 0 && (bracketIdx < 0 || braceIdx < bracketIdx) ? braceIdx : bracketIdx;
  if (start > 0) s = s.substring(start);
  return JSON.parse(s);
}

const CLASSIFY_PROMPT = `Classify columns for a semantic layer. For each table:
- role: key/dimension/measure/timestamp
- type: string/integer/decimal/boolean/date/datetime/json

CRITICAL: Each dataset MUST include the exact "tableId" from the input (e.g. "in.c-bucket.table_name"). Copy it exactly.
Also suggest metrics (SQL aggs with double-quoted column names), relationships (JOINs using tableId), glossary terms.
Keep descriptions SHORT. Respond with ONLY valid JSON:
{"datasets":[{"tableId":"in.c-bucket.table","name":"table","description":"...","grain":"...","primaryKey":["col"],"fields":[{"name":"col","role":"key","type":"string","description":"..."}]}],"metrics":[{"name":"metric","sql":"SUM(\\"col\\")","dataset":"in.c-bucket.table","description":"..."}],"relationships":[{"name":"a_to_b","from":"in.c-bucket.a","to":"in.c-bucket.b","on":"from.\\"id\\" = to.\\"id\\"","type":"left"}],"glossary":[{"term":"Term","definition":"...","seeAlso":["in.c-bucket.table"]}]}`;

const BATCH_SIZE = 5;

export async function classifyTables(tables, projectContext = {}) {
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

  const batches = [];
  for (let i = 0; i < tableSchemas.length; i += BATCH_SIZE) {
    batches.push(tableSchemas.slice(i, i + BATCH_SIZE));
  }

  console.log(`[classify] ${tableSchemas.length} tables in ${batches.length} batch(es)`);

  const merged = { datasets: [], metrics: [], relationships: [], glossary: [] };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`[classify]   Batch ${i + 1}/${batches.length} (${batch.length} tables)...`);

    try {
      const prompt = `${CLASSIFY_PROMPT}

Project: ${projectContext.projectName || "Unknown"}, SQL: ${projectContext.sqlDialect || "Snowflake"}

Tables:
${JSON.stringify(batch)}`;

      const text = await callClaude(prompt);
      const result = parseJSON(text);

      if (result.datasets) merged.datasets.push(...result.datasets);
      if (result.metrics) merged.metrics.push(...result.metrics);
      if (result.relationships) merged.relationships.push(...result.relationships);
      if (result.glossary) merged.glossary.push(...result.glossary);

      console.log(`[classify]   Batch ${i + 1} OK: ${result.datasets?.length || 0} datasets`);
    } catch (err) {
      console.error(`[classify]   Batch ${i + 1} failed:`, err.message);
    }
  }

  console.log(`[classify] Total: ${merged.datasets.length} ds, ${merged.metrics.length} met, ${merged.relationships.length} rel, ${merged.glossary.length} gl`);
  return merged;
}

export async function enrichFromFile(fileContent, fileName, modelContext) {
  console.log(`[enrich] Processing: ${fileName} (${fileContent.length} chars)`);

  const prompt = `You are enriching a semantic layer from a document. Current state:
${JSON.stringify(modelContext, null, 2)}

Document (${fileName}):
${fileContent.substring(0, 50000)}

Suggest additions. Respond with ONLY valid JSON:
{"suggestedMetrics":[],"suggestedGlossary":[],"fieldUpdates":[],"suggestedRelationships":[]}`;

  const text = await callClaude(prompt);
  return parseJSON(text);
}

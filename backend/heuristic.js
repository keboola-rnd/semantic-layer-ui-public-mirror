/**
 * Heuristic field classification — no AI needed, runs instantly.
 * Ported from Python src/classify.py.
 */

const MEASURE_PATTERN = /amount|cost|revenue|total|sum|count|hours|rate|price|quantity|value|wage|salary|fee|profit|discount|tax|budget|spend|expense|margin|balance|payment|charge|credits|size|bytes/i;

const NUMERIC_TYPES = new Set([
  "INTEGER", "INT", "BIGINT", "SMALLINT", "TINYINT",
  "DECIMAL", "FLOAT", "NUMBER", "NUMERIC", "DOUBLE", "REAL",
]);

const TIMESTAMP_TYPES = new Set([
  "DATE", "DATETIME", "TIMESTAMP", "TIMESTAMP_NTZ", "TIMESTAMP_LTZ", "TIMESTAMP_TZ",
]);

const TYPE_MAP = {
  STRING: "string", VARCHAR: "string", TEXT: "string", CHAR: "string",
  INTEGER: "integer", INT: "integer", BIGINT: "integer",
  SMALLINT: "integer", TINYINT: "integer",
  DECIMAL: "decimal", FLOAT: "decimal", NUMBER: "decimal",
  NUMERIC: "decimal", DOUBLE: "decimal", REAL: "decimal",
  BOOLEAN: "boolean", BOOL: "boolean",
  DATE: "date",
  DATETIME: "datetime", TIMESTAMP: "datetime",
  TIMESTAMP_NTZ: "datetime", TIMESTAMP_LTZ: "datetime", TIMESTAMP_TZ: "datetime",
  VARIANT: "json", OBJECT: "json", ARRAY: "json",
};

function mapType(nativeType) {
  const upper = (nativeType || "").toUpperCase().split("(")[0].trim();
  return TYPE_MAP[upper] || "string";
}

function classifyField(col, primaryKeys) {
  const name = col.name.toLowerCase();
  const nativeType = (col.nativeType || col.baseType || "VARCHAR").toUpperCase().split("(")[0].trim();
  const isPK = primaryKeys.includes(col.name);
  const type = mapType(nativeType);

  // Primary key
  if (isPK) return { role: "key", type };

  // FK pattern
  if (name.endsWith("_id") || name === "id") return { role: "key", type: "string" };

  // Timestamp types
  if (TIMESTAMP_TYPES.has(nativeType)) return { role: "timestamp", type };

  // Timestamp by name
  if (/date|_at$|_time$|timestamp|created|updated/.test(name) && !NUMERIC_TYPES.has(nativeType)) {
    return { role: "timestamp", type: type === "string" ? "date" : type };
  }

  // Measure: numeric + measure-like name
  if (NUMERIC_TYPES.has(nativeType) && MEASURE_PATTERN.test(name)) {
    return { role: "measure", type };
  }

  // Everything else is a dimension
  return { role: "dimension", type };
}

function inferGrain(tableName) {
  const name = tableName.toLowerCase();
  if (name.includes("snapshot")) return "One row per entity per snapshot date";
  if (name.includes("daily") || name.includes("_day")) return "One row per entity per day";
  if (name.includes("monthly") || name.includes("_month")) return "One row per entity per month";
  if (name.includes("event") || name.includes("log") || name.includes("activity")) return "One row per event";
  return `One row per ${name.replace(/_/g, " ")}`;
}

/**
 * Build skeleton datasets from raw table metadata — no AI, instant.
 */
export function buildSkeleton(tables) {
  const datasets = [];

  for (const [tableId, table] of Object.entries(tables)) {
    const pk = table.primaryKey || [];
    const fields = (table.columns || []).map((col) => {
      const classification = classifyField(col, pk);
      return {
        name: col.name,
        role: classification.role,
        type: classification.type,
        description: col.description || "",
      };
    });

    datasets.push({
      tableId,
      name: table.name || tableId.split(".").pop(),
      description: table.description || "",
      fqn: table.fqn || `"KEBOOLA"."${tableId.replace(/\./g, '"."')}"`,
      grain: inferGrain(table.name || ""),
      primaryKey: pk,
      fields,
      ai: { keywords: [] },
      _heuristic: true, // marker for "not yet AI-enhanced"
    });
  }

  return datasets;
}

/**
 * Generate basic metrics from measure fields — no AI.
 */
export function suggestBasicMetrics(datasets) {
  const metrics = [];
  const seen = new Set();

  for (const ds of datasets) {
    for (const field of ds.fields || []) {
      if (field.role !== "measure") continue;

      const metricName = `total_${field.name}`.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
      if (seen.has(metricName)) continue;
      seen.add(metricName);

      const aggFn = field.type === "integer" || field.type === "decimal" ? "SUM" : "COUNT";
      metrics.push({
        name: metricName,
        sql: `${aggFn}("${field.name}")`,
        dataset: ds.tableId,
        description: `Total ${field.name.replace(/_/g, " ")}`,
      });
    }
  }

  return metrics;
}

/**
 * Suggest relationships by matching column names across tables.
 */
export function suggestRelationships(datasets) {
  const relationships = [];
  const columnIndex = {}; // colName → [tableId, ...]

  for (const ds of datasets) {
    for (const field of ds.fields || []) {
      if (field.role === "key" && field.name.endsWith("_id")) {
        if (!columnIndex[field.name]) columnIndex[field.name] = [];
        columnIndex[field.name].push(ds.tableId);
      }
    }
  }

  // Find tables sharing FK columns
  for (const [colName, tableIds] of Object.entries(columnIndex)) {
    if (tableIds.length < 2) continue;
    // Create relationships between each pair
    for (let i = 0; i < tableIds.length; i++) {
      for (let j = i + 1; j < tableIds.length; j++) {
        const name = `${tableIds[i].split(".").pop()}_to_${tableIds[j].split(".").pop()}`;
        relationships.push({
          name,
          from: tableIds[i],
          to: tableIds[j],
          on: `from."${colName}" = to."${colName}"`,
          type: "left",
        });
      }
    }
  }

  return relationships;
}

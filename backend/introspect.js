/**
 * Introspect a Keboola project via Storage API.
 * Discovers buckets, tables, columns, types, PKs, FQNs.
 */

const KBC_TOKEN = () =>
  (process.env.KBC_METASTORE_TOKEN || process.env.KBC_TOKEN || "").trim();
const KBC_STORAGE_URL = () =>
  (process.env.KBC_URL || process.env.KBC_STORAGE_URL || "https://connection.us-east4.gcp.keboola.com").trim();

async function storageGet(path, token, storageUrl) {
  const url = `${storageUrl}/v2/storage${path}`;
  const resp = await fetch(url, {
    headers: { "X-StorageApi-Token": token },
  });
  if (!resp.ok) {
    throw new Error(`Storage API ${path}: ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

export async function introspectProject(options = {}) {
  const token = options.token || KBC_TOKEN();
  const storageUrl = options.storageUrl || KBC_STORAGE_URL();

  // 1. Verify token → project info
  const tokenInfo = await storageGet("/tokens/verify", token, storageUrl);
  const owner = tokenInfo.owner || {};
  const projectId = String(owner.id || "unknown");
  const projectName = owner.name || `project-${projectId}`;

  // Detect backend (Snowflake vs BigQuery)
  const defaultBackend = owner.defaultBackend || "";
  const hasBigQuery = /bigquery/i.test(defaultBackend) ||
    (owner.features || []).some((f) => /bigquery/i.test(f));
  const sqlDialect = hasBigQuery ? "BigQuery" : "Snowflake";

  // 2. Fetch buckets
  const allBuckets = await storageGet("/buckets", token, storageUrl);
  const buckets = allBuckets.map((b) => ({
    id: b.id,
    name: b.name || "",
    description: b.description || "",
    stage: b.stage || "",
    displayName: b.displayName || b.name || "",
  }));

  // 3. Fetch all tables (lightweight list)
  const allTables = await storageGet("/tables", token, storageUrl);

  // Group by bucket
  const tablesByBucket = {};
  for (const t of allTables) {
    const tid = t.id || "";
    const bucketId = tid.substring(0, tid.lastIndexOf("."));
    if (!tablesByBucket[bucketId]) tablesByBucket[bucketId] = [];
    tablesByBucket[bucketId].push({
      id: tid,
      name: t.name || "",
      displayName: t.displayName || t.name || "",
      rowsCount: t.rowsCount || 0,
    });
  }

  return {
    projectId,
    projectName,
    sqlDialect,
    storageUrl,
    buckets,
    tablesByBucket,
    totalTables: allTables.length,
  };
}

async function fetchSingleTable(tableId, token, storageUrl) {
  const t = await storageGet(`/tables/${tableId}`, token, storageUrl);

  const columns = [];
  const colMetadata = t.columnMetadata || {};
  for (const colName of t.columns || []) {
    const col = { name: colName };
    const meta = colMetadata[colName] || [];
    for (const m of meta) {
      if (m.key === "KBC.datatype.type") col.nativeType = m.value;
      else if (m.key === "KBC.datatype.basetype") col.baseType = m.value;
      else if (m.key === "KBC.description") col.description = m.value;
    }
    columns.push(col);
  }

  const bucketInfo = t.bucket || {};
  const bucketId =
    typeof bucketInfo === "object"
      ? bucketInfo.id || ""
      : tableId.substring(0, tableId.lastIndexOf("."));

  return {
    id: tableId,
    name: t.name || "",
    description: t.description || "",
    primaryKey: t.primaryKey || [],
    columns,
    rowsCount: t.rowsCount || 0,
    bucketId,
  };
}

/**
 * Known SQL transformation component IDs on Keboola.
 * We check each one; components that don't exist for the project simply 404.
 */
const SQL_TRANSFORM_COMPONENT_IDS = [
  "keboola.snowflake-transformation",
  "keboola.bigquery-transformation",
  "keboola.synapse-transformation",
  "keboola.redshift-sql-transformation",
  "keboola.oracle-transformation",
];

/**
 * Fetch all SQL transformation configs from a Keboola project.
 *
 * 1. Calls GET /v2/storage/components to list all components (or falls back
 *    to a hardcoded list of known SQL transformation component IDs).
 * 2. For each SQL transformation component, calls GET /v2/storage/components/{id}/configs.
 * 3. Extracts SQL queries from configuration.parameters.blocks[].codes[].script[]
 *    and the legacy configuration.parameters.queries[] format.
 * 4. Extracts input/output table mappings from configuration.storage.{input,output}.tables[].
 * 5. Also handles row-based transformations (config.rows[]).
 *
 * @param {Object} options
 * @param {string} options.token - Keboola Storage API token
 * @param {string} options.storageUrl - Storage API base URL
 * @returns {Promise<Object>} - { transformations: Array, componentsSeen: Array, errors: Array }
 */
export async function fetchTransformations(options = {}) {
  const token = options.token || KBC_TOKEN();
  const storageUrl = options.storageUrl || KBC_STORAGE_URL();
  const errors = [];

  // --- Step 1: Discover SQL transformation components ---
  let sqlComponentIds = [];
  try {
    console.log("[introspect] Fetching component list from /v2/storage/components ...");
    const allComponents = await storageGet("/components", token, storageUrl);

    // Filter to SQL transformation components by ID pattern or type
    for (const comp of allComponents) {
      const id = comp.id || "";
      const type = comp.type || "";
      // Include if the component type is "transformation" and it looks SQL-related
      if (
        type === "transformation" &&
        /sql|snowflake|bigquery|synapse|redshift|oracle/i.test(id)
      ) {
        sqlComponentIds.push(id);
      }
    }
    console.log(`[introspect] Found ${sqlComponentIds.length} SQL transformation components: ${sqlComponentIds.join(", ") || "(none)"}`);
  } catch (err) {
    console.warn(`[introspect] Could not list components (${err.message}), falling back to hardcoded list`);
    sqlComponentIds = [...SQL_TRANSFORM_COMPONENT_IDS];
  }

  // Merge with hardcoded list to ensure we don't miss any
  const allIds = new Set([...sqlComponentIds, ...SQL_TRANSFORM_COMPONENT_IDS]);
  console.log(`[introspect] Checking ${allIds.size} component IDs for configs...`);

  // --- Step 2: Fetch configs for each component ---
  const transformations = [];
  const componentsSeen = [];

  for (const componentId of allIds) {
    let configs;
    try {
      // Include rows — row-based transformations store SQL in rows, not top-level config
      configs = await storageGet(`/components/${componentId}/configs?include=rows`, token, storageUrl);
    } catch (err) {
      // 404 = component doesn't exist for this project (expected), skip silently
      if (err.message.includes("404")) {
        continue;
      }
      const msg = `Error fetching configs for ${componentId}: ${err.message}`;
      console.warn(`[introspect] ${msg}`);
      errors.push(msg);
      continue;
    }

    if (!Array.isArray(configs) || configs.length === 0) {
      continue;
    }

    componentsSeen.push(componentId);
    console.log(`[introspect] ${componentId}: ${configs.length} config(s), rows included: ${configs.some(c => c.rows?.length > 0)}`);

    for (const config of configs) {
      const configId = config.id || "";
      const configName = config.name || "";
      const configDescription = config.description || "";
      let conf = config.configuration || {};

      // --- Step 3: Extract SQL queries ---
      const queries = [];
      const params = conf.parameters || {};

      // Primary format: blocks[].codes[].script[]
      const blocks = params.blocks || [];
      for (const block of blocks) {
        const blockName = block.name || "";
        for (const code of block.codes || []) {
          const codeName = code.name || "";
          const script = code.script || [];
          for (const sqlLine of script) {
            if (typeof sqlLine === "string" && sqlLine.trim()) {
              queries.push({
                sql: sqlLine,
                blockName,
                codeName,
                source: "config",
              });
            }
          }
        }
      }

      // Legacy format: parameters.queries[]
      const legacyQueries = params.queries || [];
      for (const q of legacyQueries) {
        if (typeof q === "string" && q.trim()) {
          queries.push({
            sql: q,
            blockName: "",
            codeName: "",
            source: "config-legacy",
          });
        }
      }

      // --- Step 4: Extract input/output table mappings ---
      const storage = conf.storage || {};
      const inputTables = (storage.input || {}).tables || [];
      const outputTables = (storage.output || {}).tables || [];

      const inputMappings = inputTables.map((t) => ({
        source: t.source || "",
        destination: t.destination || "",
        columns: t.columns || [],
        whereColumn: t.where_column || "",
        whereValues: t.where_values || [],
        whereOperator: t.where_operator || "",
      }));

      const outputMappings = outputTables.map((t) => ({
        source: t.source || "",
        destination: t.destination || "",
        primaryKey: t.primary_key || [],
        incremental: t.incremental || false,
        deleteWhereColumn: t.delete_where_column || "",
        deleteWhereValues: t.delete_where_values || [],
        deleteWhereOperator: t.delete_where_operator || "",
      }));

      // --- Step 5: Handle row-based transformations ---
      // If rows aren't in the list response, fetch them individually
      let rows = config.rows || [];
      if (rows.length === 0 && queries.length === 0) {
        try {
          const fullConfig = await storageGet(
            `/components/${componentId}/configs/${configId}`,
            token,
            storageUrl
          );
          rows = fullConfig.rows || [];
          // Also grab any top-level SQL we may have missed
          const fullConf = fullConfig.configuration || {};
          const fullParams = fullConf.parameters || {};
          for (const block of fullParams.blocks || []) {
            for (const code of block.codes || []) {
              for (const sqlLine of code.script || []) {
                if (typeof sqlLine === "string" && sqlLine.trim()) {
                  queries.push({
                    sql: sqlLine,
                    blockName: block.name || "",
                    codeName: code.name || "",
                    source: "config-detail",
                  });
                }
              }
            }
          }
          // Also check full config for input/output mappings
          const fullStorage = fullConf.storage || {};
          for (const t of (fullStorage.input || {}).tables || []) {
            if (t.source && !inputMappings.some((m) => m.source === t.source)) {
              inputMappings.push({
                source: t.source || "",
                destination: t.destination || "",
                columns: t.columns || [],
                whereColumn: t.where_column || "",
                whereValues: t.where_values || [],
                whereOperator: t.where_operator || "",
              });
            }
          }
          if (rows.length > 0) {
            console.log(`[introspect]   Config ${configName}: fetched ${rows.length} rows individually`);
          }
        } catch (err) {
          console.warn(`[introspect]   Could not fetch config detail for ${configId}: ${err.message}`);
        }
      }

      for (const row of rows) {
        const rowId = row.id || "";
        const rowName = row.name || "";
        const rowConf = row.configuration || {};
        const rowParams = rowConf.parameters || {};

        for (const block of rowParams.blocks || []) {
          const blockName = block.name || "";
          for (const code of block.codes || []) {
            const codeName = code.name || "";
            for (const sqlLine of code.script || []) {
              if (typeof sqlLine === "string" && sqlLine.trim()) {
                queries.push({
                  sql: sqlLine,
                  blockName,
                  codeName,
                  source: `row:${rowId}:${rowName}`,
                });
              }
            }
          }
        }

        // Legacy row queries
        for (const q of rowParams.queries || []) {
          if (typeof q === "string" && q.trim()) {
            queries.push({
              sql: q,
              blockName: "",
              codeName: "",
              source: `row-legacy:${rowId}:${rowName}`,
            });
          }
        }

        // Row-level table mappings
        const rowStorage = rowConf.storage || {};
        const rowInputTables = (rowStorage.input || {}).tables || [];
        const rowOutputTables = (rowStorage.output || {}).tables || [];

        for (const t of rowInputTables) {
          inputMappings.push({
            source: t.source || "",
            destination: t.destination || "",
            columns: t.columns || [],
            whereColumn: t.where_column || "",
            whereValues: t.where_values || [],
            whereOperator: t.where_operator || "",
            rowId,
            rowName,
          });
        }
        for (const t of rowOutputTables) {
          outputMappings.push({
            source: t.source || "",
            destination: t.destination || "",
            primaryKey: t.primary_key || [],
            incremental: t.incremental || false,
            deleteWhereColumn: t.delete_where_column || "",
            deleteWhereValues: t.delete_where_values || [],
            deleteWhereOperator: t.delete_where_operator || "",
            rowId,
            rowName,
          });
        }
      }

      // Only include configs that actually have content
      if (queries.length > 0 || inputMappings.length > 0 || outputMappings.length > 0) {
        transformations.push({
          componentId,
          configId,
          configName,
          configDescription,
          queries,
          inputMappings,
          outputMappings,
          totalSqlStatements: queries.length,
          totalInputMappings: inputMappings.length,
          totalOutputMappings: outputMappings.length,
        });
      }
    }
  }

  const totalQueries = transformations.reduce((sum, t) => sum + t.totalSqlStatements, 0);
  const totalInputs = transformations.reduce((sum, t) => sum + t.totalInputMappings, 0);
  const totalOutputs = transformations.reduce((sum, t) => sum + t.totalOutputMappings, 0);

  console.log(`[introspect] Transformations complete: ${transformations.length} configs, ${totalQueries} SQL statements, ${totalInputs} input mappings, ${totalOutputs} output mappings`);
  if (errors.length > 0) {
    console.warn(`[introspect] ${errors.length} error(s) encountered during fetch`);
  }

  return {
    transformations,
    componentsSeen,
    errors,
    summary: {
      totalConfigs: transformations.length,
      totalSqlStatements: totalQueries,
      totalInputMappings: totalInputs,
      totalOutputMappings: totalOutputs,
    },
  };
}

export async function fetchTableDetails(tableIds, options = {}) {
  const token = options.token || KBC_TOKEN();
  const storageUrl = options.storageUrl || KBC_STORAGE_URL();

  console.log(`[introspect] Fetching details for ${tableIds.length} tables (parallel, batches of 10)...`);

  const tables = {};
  // Fetch in parallel batches of 10 to avoid overwhelming the API
  const BATCH_SIZE = 10;
  for (let i = 0; i < tableIds.length; i += BATCH_SIZE) {
    const batch = tableIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((id) => fetchSingleTable(id, token, storageUrl))
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        tables[batch[j]] = r.value;
      } else {
        console.error(`Failed to fetch ${batch[j]}:`, r.reason?.message);
      }
    }
    if (i + BATCH_SIZE < tableIds.length) {
      console.log(`[introspect]   ... ${Math.min(i + BATCH_SIZE, tableIds.length)}/${tableIds.length}`);
    }
  }

  console.log(`[introspect] Fetched ${Object.keys(tables).length}/${tableIds.length} tables`);
  return tables;
}

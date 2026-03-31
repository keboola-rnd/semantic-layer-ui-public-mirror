/**
 * Introspect a Keboola project via Storage API.
 * Discovers buckets, tables, columns, types, PKs, FQNs.
 */

const KBC_TOKEN = () =>
  (process.env.KBC_METASTORE_TOKEN || process.env.KBC_TOKEN || "").trim();
const KBC_STORAGE_URL = () =>
  (process.env.KBC_STORAGE_URL || "https://connection.us-east4.gcp.keboola.com").trim();

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
  const backendRaw =
    owner.defaultBackend ||
    (owner.features || []).find((f) => /bigquery/i.test(f))
      ? "bigquery"
      : "snowflake";
  const sqlDialect = /bigquery/i.test(backendRaw) ? "BigQuery" : "Snowflake";

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

export async function fetchTableDetails(tableIds, options = {}) {
  const token = options.token || KBC_TOKEN();
  const storageUrl = options.storageUrl || KBC_STORAGE_URL();

  const tables = {};
  for (const tableId of tableIds) {
    try {
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

      // Build FQN from bucket metadata
      const bucketInfo = t.bucket || {};
      const bucketId =
        typeof bucketInfo === "object"
          ? bucketInfo.id || ""
          : tableId.substring(0, tableId.lastIndexOf("."));

      tables[tableId] = {
        id: tableId,
        name: t.name || "",
        description: t.description || "",
        primaryKey: t.primaryKey || [],
        columns,
        rowsCount: t.rowsCount || 0,
        bucketId,
      };
    } catch (err) {
      console.error(`Failed to fetch ${tableId}:`, err.message);
    }
  }

  return tables;
}

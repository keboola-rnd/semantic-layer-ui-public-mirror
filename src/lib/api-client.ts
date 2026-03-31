import type { MetastoreObject, SemanticObjectType } from "./types";

const TOKEN_KEY = "metastore-token";

// When running behind the Express server (Keboola deployment),
// the server injects the token via proxy — no client-side token needed.
let serverAuthenticated = false;

export async function checkServerAuth(): Promise<boolean> {
  try {
    const resp = await fetch("/auth/status");
    if (resp.ok) {
      const data = await resp.json();
      serverAuthenticated = data.authenticated;
      return serverAuthenticated;
    }
  } catch {
    // Not running behind Express server (dev mode with Vite proxy)
  }
  return false;
}

export function isServerAuthenticated(): boolean {
  return serverAuthenticated;
}

function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredToken(): string {
  return getToken();
}

export function isAuthenticated(): boolean {
  return serverAuthenticated || !!getToken();
}

function headers(): HeadersInit {
  const h: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  // Only send token from client if NOT server-authenticated
  // (server proxy injects it automatically)
  if (!serverAuthenticated) {
    const token = getToken();
    if (token) {
      (h as Record<string, string>)["X-StorageAPI-Token"] = token;
    }
  }
  return h;
}

function normalizeObject<T>(raw: Record<string, unknown>): MetastoreObject<T> {
  const attrs = raw.attributes as Record<string, unknown>;
  return {
    type: raw.type as string,
    id: raw.id as string,
    attributes: (attrs.data ?? attrs) as T,
    meta: raw.meta as MetastoreObject<T>["meta"],
  };
}

export async function listObjects<T>(
  objectType: SemanticObjectType,
  modelUUID?: string
): Promise<MetastoreObject<T>[]> {
  const limit = objectType === "semantic-dataset" ? 1 : 20;
  let offset = 0;
  const items: MetastoreObject<T>[] = [];
  let consecutiveErrors = 0;

  while (consecutiveErrors < 3) {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (modelUUID) {
      params.set("filter", `modelUUID=${modelUUID}`);
    }

    try {
      const resp = await fetch(
        `/api/v1/repository/${objectType}?${params}`,
        { headers: headers() }
      );
      if (!resp.ok) {
        consecutiveErrors++;
        offset += limit;
        continue;
      }
      const body = await resp.json();
      const data = body.data;
      if (!data || !Array.isArray(data) || data.length === 0) {
        if (body.error) {
          consecutiveErrors++;
          offset += limit;
          continue;
        }
        break;
      }
      consecutiveErrors = 0;
      for (const item of data) {
        items.push(normalizeObject<T>(item));
      }
      if (data.length < limit) break;
      offset += limit;
    } catch {
      consecutiveErrors++;
      offset += limit;
    }
  }
  return items;
}

export async function getObject<T>(
  objectType: SemanticObjectType,
  uuid: string
): Promise<MetastoreObject<T>> {
  const resp = await fetch(`/api/v1/repository/${objectType}/${uuid}`, {
    headers: headers(),
  });
  if (!resp.ok) throw new Error(`Failed to get ${objectType}/${uuid}: ${resp.status}`);
  const body = await resp.json();
  const raw = body.data ?? body;
  return normalizeObject<T>(raw);
}

export async function createObject<T>(
  objectType: SemanticObjectType,
  name: string,
  data: Record<string, unknown>
): Promise<MetastoreObject<T>> {
  const resp = await fetch(`/api/v1/repository/${objectType}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name,
      data,
      branch: "main",
      schemaVersion: "1.0.0",
      scope: "project",
    }),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Create ${objectType} failed (${resp.status}): ${errBody}`);
  }
  const body = await resp.json();
  const raw = body.data ?? body;
  return normalizeObject<T>(raw);
}

export async function updateObject<T>(
  objectType: SemanticObjectType,
  uuid: string,
  data: Record<string, unknown>
): Promise<MetastoreObject<T>> {
  const resp = await fetch(`/api/v1/repository/${objectType}/${uuid}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ data }),
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Update ${objectType}/${uuid} failed (${resp.status}): ${errBody}`);
  }
  const body = await resp.json();
  const raw = body.data ?? body;
  return normalizeObject<T>(raw);
}

export async function deleteObject(
  objectType: SemanticObjectType,
  uuid: string
): Promise<void> {
  const resp = await fetch(`/api/v1/repository/${objectType}/${uuid}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!resp.ok) {
    throw new Error(`Delete ${objectType}/${uuid} failed: ${resp.status}`);
  }
}

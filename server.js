import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Metastore config from env vars (Keboola secrets)
const METASTORE_URL =
  process.env.METASTORE_URL || "https://metastore.us-east4.gcp.keboola.com";
const KBC_TOKEN = process.env.KBC_TOKEN || "";

// Health check + debug info
app.get("/health", (_req, res) =>
  res.json({
    status: "ok",
    metastoreUrl: METASTORE_URL,
    hasToken: !!KBC_TOKEN,
    tokenPrefix: KBC_TOKEN ? KBC_TOKEN.substring(0, 8) + "..." : "none",
  })
);

// Auth check — lets the React app know if server-side auth is available
app.all("/auth/status", (_req, res) => {
  res.json({
    authenticated: !!KBC_TOKEN,
    metastoreUrl: METASTORE_URL,
  });
});

// Proxy /api/* to the metastore, injecting the token
app.use(
  createProxyMiddleware({
    target: METASTORE_URL,
    changeOrigin: true,
    pathFilter: "/api",
    logger: console,
    on: {
      proxyReq: (proxyReq) => {
        if (KBC_TOKEN) {
          proxyReq.setHeader("X-StorageAPI-Token", KBC_TOKEN);
        }
      },
      proxyRes: (proxyRes, req) => {
        console.log(
          `[proxy] ${req.method} ${req.url} → ${proxyRes.statusCode}`
        );
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

// Serve built React app
app.use(express.static(join(__dirname, "dist"), { index: false }));

// SPA fallback — handle all routes (including POST to / from Keboola)
app.all("/{*path}", (_req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Metastore UI server running on port ${PORT}`);
  console.log(`Proxying /api/* → ${METASTORE_URL}`);
  console.log(
    `Auth: ${KBC_TOKEN ? `token present (${KBC_TOKEN.substring(0, 8)}...)` : "no token (user login required)"}`
  );
});

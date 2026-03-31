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

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Auth check — lets the React app know if server-side auth is available
app.all("/auth/status", (_req, res) => {
  res.json({
    authenticated: !!KBC_TOKEN,
    metastoreUrl: METASTORE_URL,
  });
});

// Proxy /api/* to the metastore, injecting the token
// pathFilter keeps the /api prefix in the forwarded path
app.use(
  createProxyMiddleware({
    target: METASTORE_URL,
    changeOrigin: true,
    pathFilter: "/api",
    on: {
      proxyReq: (proxyReq) => {
        if (KBC_TOKEN) {
          proxyReq.setHeader("X-StorageAPI-Token", KBC_TOKEN);
        }
      },
    },
  })
);

// Serve built React app
app.use(express.static(join(__dirname, "dist"), { index: false }));

// SPA fallback — handle all routes (including POST to / from Keboola)
// Express v5 uses "{*path}" instead of "*"
app.all("/{*path}", (_req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Metastore UI server running on port ${PORT}`);
  console.log(`Proxying /api/* → ${METASTORE_URL}`);
  console.log(`Auth: ${KBC_TOKEN ? "token from env" : "no token (user login required)"}`);
});

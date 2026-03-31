import { BrowserRouter, Routes, Route } from "react-router";
import { useState, useEffect } from "react";
import { checkServerAuth, isAuthenticated } from "@/lib/api-client";
import { AppQueryProvider } from "@/providers/query-provider";
import { ModelProvider } from "@/providers/model-context";
import { Shell } from "@/components/layout/shell";
import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { DatasetsPage } from "@/pages/datasets";
import { DatasetDetailPage } from "@/pages/dataset-detail";
import { MetricsPage } from "@/pages/metrics";
import { MetricDetailPage } from "@/pages/metric-detail";
import { RelationshipsPage } from "@/pages/relationships";
import { GlossaryPage } from "@/pages/glossary";
import { GlossaryDetailPage } from "@/pages/glossary-detail";
import { ConstraintsPage } from "@/pages/constraints";
import { CreateModelPage } from "@/pages/create-model";

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Check if the Express server has a token (Keboola deployment)
    checkServerAuth().then(() => {
      setAuthenticated(isAuthenticated());
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Connecting to metastore...</p>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <AppQueryProvider>
      <ModelProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<DashboardPage />} />
              <Route path="datasets" element={<DatasetsPage />} />
              <Route path="datasets/:uuid" element={<DatasetDetailPage />} />
              <Route path="metrics" element={<MetricsPage />} />
              <Route path="metrics/:uuid" element={<MetricDetailPage />} />
              <Route path="relationships" element={<RelationshipsPage />} />
              <Route path="glossary" element={<GlossaryPage />} />
              <Route path="glossary/:uuid" element={<GlossaryDetailPage />} />
              <Route path="constraints" element={<ConstraintsPage />} />
              <Route path="create-model" element={<CreateModelPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ModelProvider>
    </AppQueryProvider>
  );
}

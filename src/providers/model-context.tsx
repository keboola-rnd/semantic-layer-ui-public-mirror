import { createContext, useContext, useState, type ReactNode } from "react";

interface ModelContextValue {
  modelUUID: string;
  setModelUUID: (uuid: string) => void;
}

const ModelContext = createContext<ModelContextValue | null>(null);

const STORAGE_KEY = "selected-model-uuid";

export function ModelProvider({ children }: { children: ReactNode }) {
  const [modelUUID, setModelUUIDState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || ""
  );

  function setModelUUID(uuid: string) {
    localStorage.setItem(STORAGE_KEY, uuid);
    setModelUUIDState(uuid);
  }

  return (
    <ModelContext.Provider value={{ modelUUID, setModelUUID }}>
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const ctx = useContext(ModelContext);
  if (!ctx) throw new Error("useModel must be inside ModelProvider");
  return ctx;
}

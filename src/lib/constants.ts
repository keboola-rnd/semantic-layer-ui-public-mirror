export const ROLE_COLORS: Record<string, string> = {
  key: "bg-purple-100 text-purple-800 border-purple-200",
  dimension: "bg-blue-100 text-blue-800 border-blue-200",
  measure: "bg-green-100 text-green-800 border-green-200",
  timestamp: "bg-orange-100 text-orange-800 border-orange-200",
};

export const TYPE_COLORS: Record<string, string> = {
  string: "bg-gray-100 text-gray-700",
  integer: "bg-indigo-50 text-indigo-700",
  decimal: "bg-indigo-50 text-indigo-700",
  boolean: "bg-amber-50 text-amber-700",
  date: "bg-cyan-50 text-cyan-700",
  datetime: "bg-cyan-50 text-cyan-700",
  json: "bg-pink-50 text-pink-700",
};

export const JOIN_TYPE_COLORS: Record<string, string> = {
  left: "bg-blue-100 text-blue-800",
  inner: "bg-green-100 text-green-800",
};

export const SEVERITY_COLORS: Record<string, string> = {
  error: "bg-red-100 text-red-800",
  warning: "bg-yellow-100 text-yellow-800",
  info: "bg-blue-100 text-blue-800",
};

export const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: "LayoutDashboard" },
  { label: "Datasets", path: "/datasets", icon: "Database" },
  { label: "Metrics", path: "/metrics", icon: "BarChart3" },
  { label: "Relationships", path: "/relationships", icon: "GitBranch" },
  { label: "Glossary", path: "/glossary", icon: "BookOpen" },
  { label: "Constraints", path: "/constraints", icon: "ShieldCheck" },
] as const;

import { useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Database,
  BarChart3,
  GitBranch,
  BookOpen,
  ShieldCheck,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Datasets", path: "/datasets", icon: Database },
  { label: "Metrics", path: "/metrics", icon: BarChart3 },
  { label: "Relationships", path: "/relationships", icon: GitBranch },
  { label: "Glossary", path: "/glossary", icon: BookOpen },
  { label: "Constraints", path: "/constraints", icon: ShieldCheck },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  function isActive(path: string) {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  }

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-muted/30 flex flex-col">
      <div className="p-4 border-b border-border">
        <button onClick={() => navigate("/")} className="text-left">
          <h1 className="text-sm font-semibold tracking-tight">Semantic Layer</h1>
          <p className="text-xs text-muted-foreground">Metastore Manager</p>
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors w-full text-left",
              isActive(item.path)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-2 border-t border-border">
        <button
          onClick={() => navigate("/create-model")}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors w-full text-left",
            isActive("/create-model")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <PlusCircle className="h-4 w-4" />
          New Model
        </button>
      </div>
    </aside>
  );
}

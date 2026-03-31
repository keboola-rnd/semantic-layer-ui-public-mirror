import { NavLink } from "react-router";
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

const ICON_MAP = {
  LayoutDashboard,
  Database,
  BarChart3,
  GitBranch,
  BookOpen,
  ShieldCheck,
  PlusCircle,
} as const;

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", icon: "LayoutDashboard" as const },
  { label: "Datasets", path: "/datasets", icon: "Database" as const },
  { label: "Metrics", path: "/metrics", icon: "BarChart3" as const },
  { label: "Relationships", path: "/relationships", icon: "GitBranch" as const },
  { label: "Glossary", path: "/glossary", icon: "BookOpen" as const },
  { label: "Constraints", path: "/constraints", icon: "ShieldCheck" as const },
];

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-muted/30 flex flex-col">
      <div className="p-4 border-b border-border">
        <h1 className="text-sm font-semibold tracking-tight">Semantic Layer</h1>
        <p className="text-xs text-muted-foreground">Metastore Manager</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon];
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-2 border-t border-border">
        <NavLink
          to="/create-model"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )
          }
        >
          <PlusCircle className="h-4 w-4" />
          New Model
        </NavLink>
      </div>
    </aside>
  );
}

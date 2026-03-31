import type { MetastoreObjectMeta } from "@/lib/types";
import { formatDate, timeAgo } from "@/lib/utils";
import { GitCommitVertical, Clock, Calendar, Hash } from "lucide-react";

/** Full metadata panel for detail pages */
export function ObjectMetaPanel({ meta, uuid }: { meta: MetastoreObjectMeta; uuid: string }) {
  return (
    <div className="border border-border rounded-lg bg-muted/20 p-4 space-y-3">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Object Metadata
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetaItem icon={GitCommitVertical} label="Revision" value={`v${meta.revision}`} />
        <MetaItem icon={Calendar} label="Created" value={formatDate(meta.createdAt)} subtitle={timeAgo(meta.createdAt)} />
        <MetaItem icon={Clock} label="Last Updated" value={formatDate(meta.lastUpdated)} subtitle={timeAgo(meta.lastUpdated)} />
        <MetaItem icon={Hash} label="Schema Version" value={meta.schemaVersion || "-"} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
        <MetaItem label="UUID" value={uuid} mono />
        <MetaItem label="Project" value={String(meta.projectId)} />
        <MetaItem label="Organization" value={meta.organizationId} />
        <MetaItem label="Branch" value={meta.branch || "main"} />
      </div>
    </div>
  );
}

/** Compact inline revision badge for list views */
export function RevisionBadge({ revision, updatedAt }: { revision: number; updatedAt: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
      title={`Last updated: ${formatDate(updatedAt)}`}
    >
      <span className="bg-muted px-1.5 py-0.5 rounded font-mono">v{revision}</span>
      <span className="hidden sm:inline">{timeAgo(updatedAt)}</span>
    </span>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
  subtitle,
  mono,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className={`text-xs ${mono ? "font-mono text-[10px] break-all" : "font-medium"}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[10px] text-muted-foreground">{subtitle}</div>
      )}
    </div>
  );
}

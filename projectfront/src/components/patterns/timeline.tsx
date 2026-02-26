type TimelineItem = {
  title: string;
  description: string;
  timestamp: string;
  status?: "pending" | "success" | "warning" | "danger";
};

const statusColorMap: Record<NonNullable<TimelineItem["status"]>, string> = {
  pending: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-100 text-emerald-600",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-destructive/10 text-destructive",
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="space-y-6">
      {items.map((item) => (
        <li key={item.title} className="relative pl-8">
          <span className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-border bg-background" />
          <div className="flex items-center gap-4">
            <p className="text-base font-semibold text-foreground">{item.title}</p>
            {item.status ? (
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColorMap[item.status]}`}>
                {item.status}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{item.description}</p>
          <p className="text-xs uppercase tracking-wide text-primary/70">{item.timestamp}</p>
        </li>
      ))}
    </ol>
  );
}

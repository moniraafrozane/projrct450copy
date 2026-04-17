import { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type StatTrend = "up" | "down" | "flat";

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  trend?: StatTrend;
  icon?: ReactNode;
  badge?: ReactNode;
};

const trendCopy: Record<StatTrend, string> = {
  up: "text-emerald-600",
  down: "text-destructive",
  flat: "text-muted-foreground",
};

export function StatCard({ label, value, helper, trend = "flat", icon, badge }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden border-border/70">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{label}</span>
          {badge ?? (icon ? <span className="text-lg text-primary/80">{icon}</span> : null)}
        </div>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
        {helper ? (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant={trend === "down" ? "destructive" : trend === "up" ? "success" : "outline"}>
              {trend === "up" && "▲"}
              {trend === "down" && "▼"}
              {trend === "flat" && "•"}
            </Badge>
            <span className={trendCopy[trend]}>{helper}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

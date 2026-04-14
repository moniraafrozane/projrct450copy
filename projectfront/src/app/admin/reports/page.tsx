"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { MonthlyBudgetChart } from "@/components/patterns/monthly-budget-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  analyticsReportAPI,
  type MonthlyBudgetEvent,
  type AnalyticsReport,
} from "@/lib/api";

function formatMetricValue(metric: { value: number; format: "number" | "currency" }) {
  if (metric.format === "currency") {
    return `BDT ${Number(metric.value || 0).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
  }

  return Number(metric.value || 0).toLocaleString("en-GB", { maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<AnalyticsReport[]>([]);
  const [monthlyBudgetEvents, setMonthlyBudgetEvents] = useState<MonthlyBudgetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthlyBudgetLoading, setMonthlyBudgetLoading] = useState(true);
  const [error, setError] = useState("");
  const [monthlyBudgetError, setMonthlyBudgetError] = useState("");
  const [message, setMessage] = useState("");

  const loadReports = async () => {
    setLoading(true);
    setError("");

    try {
      const reportsRes = await analyticsReportAPI.getReports();
      setReports(reportsRes.reports);
    } catch {
      setError("Failed to load analytics reports.");
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlyBudget = async () => {
    setMonthlyBudgetLoading(true);
    setMonthlyBudgetError("");

    try {
      const response = await analyticsReportAPI.getMonthlyBudgetEvents();
      setMonthlyBudgetEvents(response.events);
    } catch {
      setMonthlyBudgetError("Failed to load monthly budget data.");
      setMonthlyBudgetEvents([]);
    } finally {
      setMonthlyBudgetLoading(false);
    }
  };

  const refreshAnalytics = async () => {
    setMessage("");
    setError("");
    await Promise.all([loadReports(), loadMonthlyBudget()]);
  };

  useEffect(() => {
    refreshAnalytics();
  }, []);

  const openBuilder = () => {
    setMessage("");
    setError("");
    router.push("/admin/reports/new");
  };

  const handleExport = async (reportId: string, format: "pdf" | "xlsx" = "pdf") => {
    setError("");
    setMessage("");

    try {
      await analyticsReportAPI.downloadReport(reportId, format);
      setMessage(`Analytics report exported as ${format.toUpperCase()}.`);
    } catch {
      setError("Failed to export analytics report.");
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Analytics & exports"
        description="Generate custom report snapshots for yearly events, budgets, and student participation."
        actions={[
          { label: "Generate report", onClick: openBuilder },
          { label: "Refresh analytics", variant: "secondary", onClick: refreshAnalytics },
        ]}
      />

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      <SectionCard
        title="Snapshots"
        description="Saved analytics reports appear here immediately after generation."
        actions={<Button variant="outline" onClick={openBuilder}>Generate report</Button>}
      >
        {loading ? (
          <div className="rounded-2xl border border-border/70 p-6 text-sm text-muted-foreground">
            Loading report snapshots...
          </div>
        ) : reports.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {reports.map((report) => (
              <div key={report.id} className="rounded-3xl border border-border/70 p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{report.title}</h3>
                      <Badge variant="accent">Year {report.reportYear}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created by {report.createdByName} · {formatDate(report.createdAt)}
                    </p>
                    {report.notes ? (
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{report.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleExport(report.id, "pdf")}>PDF</Button>
                    <Button size="sm" variant="outline" onClick={() => handleExport(report.id, "xlsx")}>Excel</Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {report.metricValues.map((metric) => (
                    <div key={metric.key} className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">
                        {formatMetricValue(metric)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {metric.source === "manual" ? "Manually filled" : "Auto-calculated"}
                        {metric.autoValue !== metric.value ? ` · System value: ${formatMetricValue({ value: metric.autoValue, format: metric.format })}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
            No saved reports yet. Generate one to populate the Snapshots section.
          </div>
        )}
      </SectionCard>

      <div className="rounded-2xl border border-border/70 p-6">
        {monthlyBudgetError ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {monthlyBudgetError}
          </div>
        ) : null}

        <MonthlyBudgetChart
          events={monthlyBudgetEvents}
          loading={monthlyBudgetLoading}
          emptyMessage="No past events with budgets were found for the chart."
        />
      </div>
    </div>
  );
}

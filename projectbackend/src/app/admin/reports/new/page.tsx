"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  analyticsReportAPI,
  type AnalyticsMetricDefinition,
  type AnalyticsMetricKey,
} from "@/lib/api";

type MetricDraft = Partial<Record<AnalyticsMetricKey, string>>;

export default function NewAnalyticsReportPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<AnalyticsMetricDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [defaultYear, setDefaultYear] = useState(new Date().getFullYear());
  const [title, setTitle] = useState("Annual analytics report");
  const [notes, setNotes] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [selectedMetrics, setSelectedMetrics] = useState<AnalyticsMetricKey[]>([]);
  const [metricDraft, setMetricDraft] = useState<MetricDraft>({});

  useEffect(() => {
    const loadOptions = async () => {
      setLoading(true);
      setError("");

      try {
        const optionsRes = await analyticsReportAPI.getMetricOptions();
        setMetrics(optionsRes.metrics);
        setDefaultYear(optionsRes.defaultYear);
        setYear(String(optionsRes.defaultYear));
        setSelectedMetrics(optionsRes.metrics.map((metric) => metric.key));
      } catch {
        setError("Failed to load report metric options.");
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, []);

  const toggleMetric = (key: AnalyticsMetricKey) => {
    setSelectedMetrics((prev) =>
      prev.includes(key) ? prev.filter((metricKey) => metricKey !== key) : [...prev, key]
    );
  };

  const handleCreateReport = async () => {
    const numericYear = Number(year);

    if (!title.trim()) {
      setError("Add a report title before generating the snapshot.");
      return;
    }

    if (!Number.isInteger(numericYear)) {
      setError("Enter a valid report year.");
      return;
    }

    if (!selectedMetrics.length) {
      setError("Select at least one metric.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payloadValues = Object.fromEntries(
        Object.entries(metricDraft).filter(([, value]) => value !== undefined && value !== "")
      ) as Partial<Record<AnalyticsMetricKey, string>>;

      await analyticsReportAPI.createReport({
        title: title.trim(),
        year: numericYear,
        notes: notes.trim() || undefined,
        metricKeys: selectedMetrics,
        metricValues: payloadValues,
      });

      setMessage("Report created successfully");
    } catch (error: unknown) {
      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === "string"
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;

      setError(errorMessage || "Failed to generate analytics report.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push("/admin/reports");
  };

  return (
    <div className="space-y-8">
      <SectionCard
        title="Generate analytics report"
        description="Select metrics, optionally override values, then generate a new snapshot."
      >
        {message ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-border/70 p-6 text-sm text-muted-foreground">
            Loading report options...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="report-title">Report title</Label>
                <Input id="report-title" value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-year">Report year</Label>
                <Input
                  id="report-year"
                  type="number"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  placeholder={String(defaultYear)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-notes">Notes</Label>
              <Textarea
                id="report-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional remarks for the snapshot"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label>Metrics</Label>
                <span className="text-xs text-muted-foreground">
                  Leave a value blank to use the system-calculated amount.
                </span>
              </div>

              <div className="space-y-3">
                {metrics.map((metric) => {
                  const active = selectedMetrics.includes(metric.key);
                  return (
                    <div key={metric.key} className="rounded-2xl border border-border/70 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">{metric.label}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">{metric.description}</p>
                        </div>
                        <Button size="sm" variant={active ? "secondary" : "outline"} onClick={() => toggleMetric(metric.key)}>
                          {active ? "Remove" : "Add"}
                        </Button>
                      </div>

                      {active ? (
                        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_180px] md:items-end">
                          <div className="space-y-2">
                            <Label htmlFor={`metric-${metric.key}`}>Value</Label>
                            <Input
                              id={`metric-${metric.key}`}
                              type="text"
                              value={metricDraft[metric.key] ?? ""}
                              onChange={(event) =>
                                setMetricDraft((prev) => ({
                                  ...prev,
                                  [metric.key]: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-3 text-xs text-muted-foreground">
                            {metric.format === "currency" ? "Formatted in BDT" : "Numeric count"}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleCreateReport} disabled={saving}>
                {saving ? "Generating..." : "Generate report"}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

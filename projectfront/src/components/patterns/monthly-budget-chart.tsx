"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyBudgetEvent } from "@/lib/api";

type MonthlyBudgetChartProps = {
  events: MonthlyBudgetEvent[];
  loading?: boolean;
  emptyMessage?: string;
};

type MonthlyBudgetPoint = {
  name: string;
  eventDate: string;
  budget: number;
};

function formatCurrency(value: number) {
  return `BDT ${Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
}

function formatValueLabel(value: number) {
  return Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function MonthlyBudgetChart({ events, loading = false, emptyMessage }: MonthlyBudgetChartProps) {
  const chartData = useMemo<MonthlyBudgetPoint[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events
      .filter((event) => {
        const eventDate = new Date(event.date);
        return !Number.isNaN(eventDate.getTime()) && eventDate < today;
      })
      .map((event) => ({
        name: event.name,
        eventDate: event.date,
        budget: Number(event.budget || 0),
      }))
      .sort((left, right) => new Date(left.eventDate).getTime() - new Date(right.eventDate).getTime());
  }, [events]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/70 p-6 text-sm text-muted-foreground">
        Loading event budget chart...
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
        {emptyMessage || "No past events found for the monthly budget chart."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-foreground">Event Budget Distribution</h3>

      <div className="h-[420px] w-full rounded-lg border border-[#cfcfcf] bg-[#ececec] p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="horizontal"
            barCategoryGap="16%"
            margin={{ top: 36, right: 18, bottom: 44, left: 18 }}
          >
            <CartesianGrid stroke="#d0d0d0" vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={{ stroke: "#666" }}
              axisLine={{ stroke: "#666" }}
              tickMargin={10}
              stroke="#333"
              tick={{ fill: "#333", fontSize: 12 }}
              interval={0}
              angle={0}
              textAnchor="middle"
              label={{ value: "Event Name", position: "insideBottom", offset: -10, fill: "#333" }}
            />
            <YAxis
              tickLine={{ stroke: "#666" }}
              axisLine={{ stroke: "#666" }}
              tickMargin={10}
              stroke="#333"
              tick={{ fill: "#333", fontSize: 12 }}
              tickFormatter={(value) => `${Number(value).toLocaleString("en-GB")}`}
              label={{ value: "Budget (BDT)", angle: -90, position: "insideLeft", fill: "#333" }}
            />
            <Bar dataKey="budget" name="Budget" barSize={52} minPointSize={8} fill="#1f77b4" radius={[0, 0, 0, 0]}>
              <LabelList
                dataKey="budget"
                position="top"
                fill="#1f1f1f"
                fontSize={12}
                formatter={(value: number) => formatValueLabel(value)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

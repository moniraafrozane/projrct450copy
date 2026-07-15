"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PieLabelRenderProps, PieSectorDataItem } from "recharts";
import type { FeeStatusBySession } from "@/lib/api";

type SocietyFeeStatusChartsProps = {
  overall: { paidCount: number; unpaidCount: number; total: number };
  bySession: FeeStatusBySession[];
  loading?: boolean;
  error?: string;
};

type SessionSlice = FeeStatusBySession & { unpaidPercentage: number };

const PAID_COLOR = "#10b981";
const UNPAID_COLOR = "#f43f5e";
const OUTER_RADIUS = 100;
const SESSION_LABEL_RADIUS = OUTER_RADIUS + 55;
const UNPAID_OUTSIDE_LABEL_RADIUS = OUTER_RADIUS + 10;
const RADIAN = Math.PI / 180;

function formatPercentage(value: number) {
  return `${Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  return {
    x: cx + radius * Math.cos(-angleDeg * RADIAN),
    y: cy + radius * Math.sin(-angleDeg * RADIAN),
  };
}

export function SocietyFeeStatusCharts({ overall, bySession, loading = false, error }: SocietyFeeStatusChartsProps) {
  const sessionData = useMemo<SessionSlice[]>(
    () =>
      bySession.map((bucket) => ({
        ...bucket,
        unpaidPercentage: Math.round((100 - bucket.paidPercentage) * 10) / 10,
      })),
    [bySession]
  );

  const barData = useMemo(() => bySession.map((bucket) => ({ ...bucket })), [bySession]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/70 p-6 text-sm text-muted-foreground">
        Loading society fee status charts...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        {error}
      </div>
    );
  }

  if (!overall.total) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
        No student fee records were found to build the society fee status charts.
      </div>
    );
  }

  // Renders the session name around the outer rim of its wedge.
  const renderSessionLabel = (props: PieLabelRenderProps) => {
    const { cx, cy, midAngle, payload } = props as PieLabelRenderProps & { payload: SessionSlice };
    const { x, y } = polarToCartesian(Number(cx), Number(cy), SESSION_LABEL_RADIUS, midAngle ?? 0);
    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={600} fill="#333">
        {payload.session}
      </text>
    );
  };

  // Draws the inner "paid" sector, whose radius (within the wedge) scales with that
  // session's paid percentage, layered on top of the full-radius "unpaid" wedge.
  const renderPaidSector = (props: PieSectorDataItem) => {
    const { cx, cy, startAngle, endAngle, payload } = props as PieSectorDataItem & { payload: SessionSlice };
    const paidRadius = OUTER_RADIUS * ((payload.paidPercentage ?? 0) / 100);
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={0}
        outerRadius={paidRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={PAID_COLOR}
        stroke="#fff"
        strokeWidth={1}
      />
    );
  };

  // Count/percentage labels placed inside the paid (inner) and unpaid (outer ring) regions.
  const renderStatusLabels = (props: PieLabelRenderProps) => {
    const { cx, cy, midAngle, payload } = props as PieLabelRenderProps & { payload: SessionSlice };
    const centerX = Number(cx);
    const centerY = Number(cy);
    const angle = midAngle ?? 0;
    const paidRadius = OUTER_RADIUS * ((payload.paidPercentage ?? 0) / 100);

    const labels = [];

    if (payload.paidPercentage >= 10) {
      const { x, y } = polarToCartesian(centerX, centerY, paidRadius * 0.55, angle);
      labels.push(
        <text key="paid" x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#fff">
          {formatPercentage(payload.paidPercentage)}
        </text>
      );
    }

    if (payload.unpaidPercentage > 0) {
      const ringThickness = OUTER_RADIUS - paidRadius;
      // A thin unpaid ring can't fit text inside it, so push the label just past
      // the rim instead (and switch to a dark fill, since it's no longer on the color band).
      const fitsInsideRing = ringThickness >= 16;
      const unpaidLabelRadius = fitsInsideRing ? paidRadius + ringThickness / 2 : UNPAID_OUTSIDE_LABEL_RADIUS;
      const { x, y } = polarToCartesian(centerX, centerY, unpaidLabelRadius, angle);
      labels.push(
        <text
          key="unpaid"
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fitsInsideRing ? 11 : 10}
          fontWeight={fitsInsideRing ? 400 : 600}
          fill={fitsInsideRing ? "#fff" : UNPAID_COLOR}
        >
          {formatPercentage(payload.unpaidPercentage)}
        </text>
      );
    }

    return <g>{labels}</g>;
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-foreground">
          Society Fee Status by Session ({overall.total} students)
        </h3>
        <p className="text-sm text-muted-foreground">
          Overall: {overall.paidCount} paid · {overall.unpaidCount} unpaid
        </p>

        <div className="h-[460px] w-full rounded-lg border border-[#cfcfcf] bg-[#ececec] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {/* Base layer: one equal-angle wedge per session, full radius, colored "unpaid". */}
              <Pie
                data={sessionData}
                dataKey={() => 1}
                nameKey="session"
                cx="50%"
                cy="50%"
                startAngle={90}
                endAngle={-270}
                innerRadius={0}
                outerRadius={OUTER_RADIUS}
                fill={UNPAID_COLOR}
                stroke="#fff"
                strokeWidth={1}
                isAnimationActive={false}
                label={renderSessionLabel}
                labelLine={false}
              />
              {/* Overlay layer: same wedges, but each one's radius is scaled to that
                  session's paid percentage, drawn in the "paid" color on top. */}
              <Pie
                data={sessionData}
                dataKey={() => 1}
                nameKey="session"
                cx="50%"
                cy="50%"
                startAngle={90}
                endAngle={-270}
                innerRadius={0}
                outerRadius={OUTER_RADIUS}
                isAnimationActive={false}
                shape={renderPaidSector}
                label={renderStatusLabels}
                labelLine={false}
              />
              <Tooltip
                formatter={(_value, _name, item) => {
                  const p = item?.payload as SessionSlice | undefined;
                  if (!p) return ["", ""];
                  return [
                    `${p.paidCount} paid (${formatPercentage(p.paidPercentage)}) · ${p.unpaidCount} unpaid (${formatPercentage(p.unpaidPercentage)}) of ${p.total}`,
                    p.session,
                  ];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: PAID_COLOR }} />
            Paid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: UNPAID_COLOR }} />
            Unpaid
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-base font-semibold text-foreground">Fee Payment Rate by Session</h3>

        <div className="h-[420px] w-full rounded-lg border border-[#cfcfcf] bg-[#ececec] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} barCategoryGap="20%" margin={{ top: 36, right: 18, bottom: 44, left: 18 }}>
              <CartesianGrid stroke="#d0d0d0" vertical={false} />
              <XAxis
                dataKey="session"
                tickLine={{ stroke: "#666" }}
                axisLine={{ stroke: "#666" }}
                tickMargin={10}
                stroke="#333"
                tick={{ fill: "#333", fontSize: 12 }}
                label={{ value: "Session", position: "insideBottom", offset: -10, fill: "#333" }}
              />
              <YAxis
                domain={[0, 100]}
                tickLine={{ stroke: "#666" }}
                axisLine={{ stroke: "#666" }}
                tickMargin={10}
                stroke="#333"
                tick={{ fill: "#333", fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
                label={{ value: "Percentage of Students Paid", angle: -90, position: "insideLeft", fill: "#333" }}
              />
              <Tooltip
                formatter={(value, _name, item) => {
                  const numeric = typeof value === "number" ? value : Number(value ?? 0);
                  return [
                    `${formatPercentage(numeric)} (${item?.payload?.paidCount}/${item?.payload?.total} paid)`,
                    "Paid",
                  ];
                }}
              />
              <Bar dataKey="paidPercentage" name="Paid" barSize={52} minPointSize={4} fill={PAID_COLOR}>
                <LabelList
                  dataKey="paidPercentage"
                  position="top"
                  fill="#1f1f1f"
                  fontSize={12}
                  formatter={(value) => formatPercentage(Number(value))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

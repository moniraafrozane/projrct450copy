"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Voucher, voucherAPI } from "@/lib/api";

type EventGroup = {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  vouchers: Voucher[];
};

export default function VouchersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    if (searchParams.get("saved") !== "1") return;
    setActionMessage("Draft voucher saved to database");
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("saved");
    const nextUrl = nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await voucherAPI.getVouchers();
        setVouchers(response.vouchers || []);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load vouchers");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const eventGroups = useMemo<EventGroup[]>(() => {
    const map = new Map<string, EventGroup>();
    for (const v of vouchers) {
      const id = v.eventId;
      if (!map.has(id)) {
        map.set(id, {
          eventId: id,
          eventTitle: v.event?.title || "Unknown Event",
          eventDate: v.event?.eventDate || "",
          vouchers: [],
        });
      }
      map.get(id)!.vouchers.push(v);
    }
    return Array.from(map.values());
  }, [vouchers]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Vouchers & proof of expenses"
        description="Manage expense records per event. Each event groups its own expenses."
        actions={[{ label: "Create voucher", href: "/society/vouchers/new" }]}
      />

      <SectionCard title="Events with expenses" description="Click an event to view and manage its full expense list.">
        {actionMessage && (
          <div className="mb-4 rounded-2xl border border-green-500/50 bg-green-50 px-4 py-3 text-sm text-green-700">
            {actionMessage}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/50 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading vouchers...</p>
        ) : eventGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vouchers created yet. Use &quot;Create voucher&quot; to add the first one.</p>
        ) : (
          <div className="space-y-4">
            {eventGroups.map((group) => {
              const total = group.vouchers.reduce((sum, v) => sum + v.amount, 0);
              const draftCount = group.vouchers.filter((v) => v.status === "draft").length;
              const dateLabel = group.eventDate
                ? new Date(group.eventDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                : "";

              return (
                <div key={group.eventId} className="rounded-2xl border border-border/70 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground">{group.eventTitle}</p>
                      {dateLabel && (
                        <p className="text-sm text-muted-foreground">{dateLabel}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span>{group.vouchers.length} expense{group.vouchers.length !== 1 ? "s" : ""}</span>
                        {draftCount > 0 && (
                          <span className="text-amber-600">{draftCount} draft{draftCount !== 1 ? "s" : ""}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-sm font-semibold text-foreground">Total: BDT {total.toLocaleString()}</p>
                      <Button size="sm" asChild>
                        <Link href={`/society/vouchers/events/${group.eventId}`}>
                          View Expenses →
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

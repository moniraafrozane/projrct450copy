"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SectionCard } from "@/components/patterns/section-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api, { Event } from "@/lib/api";

type EventStatus = "upcoming" | "ongoing" | "completed";

type EventBuckets = {
  upcoming: Event[];
  ongoing: Event[];
  completed: Event[];
};

const EMPTY_BUCKETS: EventBuckets = {
  upcoming: [],
  ongoing: [],
  completed: [],
};

const SECTION_META: Record<EventStatus, { title: string; description: string }> = {
  upcoming: {
    title: "Upcoming Events",
    description: "Events scheduled to happen soon.",
  },
  ongoing: {
    title: "Ongoing Events",
    description: "Events that are happening right now.",
  },
  completed: {
    title: "Past Events",
    description: "Events that have already been completed.",
  },
};

export default function PublicEventsPage() {
  const searchParams = useSearchParams();
  const [eventsByStatus, setEventsByStatus] = useState<EventBuckets>(EMPTY_BUCKETS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestedStatus = searchParams.get("status");
  const activeStatus: EventStatus | null =
    requestedStatus === "upcoming" || requestedStatus === "ongoing" || requestedStatus === "completed"
      ? requestedStatus
      : null;

  const statusesToRender: EventStatus[] = activeStatus
    ? [activeStatus]
    : ["upcoming", "ongoing", "completed"];

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError("");

        const [upcomingRes, ongoingRes, completedRes] = await Promise.all([
          api.get("/events", { params: { status: "upcoming", limit: 200 } }),
          api.get("/events", { params: { status: "ongoing", limit: 200 } }),
          api.get("/events", { params: { status: "completed", limit: 200 } }),
        ]);

        setEventsByStatus({
          upcoming: upcomingRes.data?.events || [],
          ongoing: ongoingRes.data?.events || [],
          completed: completedRes.data?.events || [],
        });
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load events");
        setEventsByStatus(EMPTY_BUCKETS);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const badgeVariantForStatus = (status: EventStatus) => {
    if (status === "upcoming") return "default" as const;
    if (status === "ongoing") return "accent" as const;
    return "outline" as const;
  };

  const renderSection = (status: EventStatus) => {
    const { title, description } = SECTION_META[status];
    const events = eventsByStatus[status];

    return (
      <SectionCard title={title} description={description}>
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="h-80 animate-pulse bg-muted" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No {status === "completed" ? "past" : status} events found.
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Card key={event.id} className="overflow-hidden transition-all hover:shadow-lg">
                {event.bannerImage ? (
                  <div className="relative h-48 w-full overflow-hidden bg-linear-to-br from-primary/20 to-primary/5">
                    <img
                      src={event.bannerImage}
                      alt={event.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex h-48 w-full items-center justify-center bg-linear-to-br from-primary/20 to-primary/5">
                    <span className="text-4xl">.</span>
                  </div>
                )}

                <div className="space-y-3 p-6">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-lg font-semibold">{event.title}</h3>
                    <Badge variant={badgeVariantForStatus(status)}>
                      {status === "completed" ? "past" : status}
                    </Badge>
                  </div>

                  <p className="line-clamp-2 text-sm text-muted-foreground">{event.description}</p>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{formatDate(event.eventDate)}</span>
                    <span>{event.venue}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{event.startTime} - {event.endTime}</span>
                    {event._count ? <span>{event._count.registrations} registered</span> : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>
    );
  };

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-border/70 bg-card/80 p-8">
        <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
          {activeStatus ? SECTION_META[activeStatus].title : "All Events"}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {activeStatus
            ? SECTION_META[activeStatus].description
            : "Browse upcoming, ongoing, and past CSE Society events in one place."}
        </p>
      </section>

      {error && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </Card>
      )}

      {statusesToRender.map((status) => (
        <div key={status}>{renderSection(status)}</div>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { eventAPI, type Event } from "@/lib/api";

const formatDate = (value?: string) => {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function EventDetailsPage() {
  const params = useParams<{ id: string }>();
  const eventId = useMemo(() => (typeof params?.id === "string" ? params.id : ""), [params]);

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId) {
      setError("Invalid event id");
      setLoading(false);
      return;
    }

    const loadEvent = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await eventAPI.getEventById(eventId);
        setEvent(response.event || null);
      } catch (err: unknown) {
        const maybeAxiosError = err as { response?: { data?: { message?: string } } };
        setError(maybeAxiosError.response?.data?.message || "Failed to load event details");
        setEvent(null);
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  const statusVariant = (status?: string) => {
    if (status === "ongoing") return "accent" as const;
    if (status === "completed") return "outline" as const;
    return "default" as const;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="h-44 animate-pulse bg-muted" />
        <Card className="h-72 animate-pulse bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 p-6 text-red-700">
        <p className="text-sm font-medium">{error}</p>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/events">Back to events</Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (!event) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Event not found.</p>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/events">Back to events</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border/70 bg-card/80 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Event details</p>
            <h1 className="text-3xl font-semibold text-foreground md:text-4xl">{event.title}</h1>
            <p className="text-sm text-muted-foreground">Organized by {event.organizerName || "CSE Society"}</p>
          </div>
          <Badge variant={statusVariant(event.status)}>{event.status || "upcoming"}</Badge>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/events">Back to all events</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/student">Go to student dashboard</Link>
          </Button>
        </div>
      </section>

      {event.bannerImage ? (
        <Card className="overflow-hidden">
          <img
            src={event.bannerImage}
            alt={event.title}
            className="max-h-[420px] w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </Card>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold text-foreground">Overview</h2>
          <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{event.description}</p>

          {(event.keyTopics || event.benefits || event.eligibility) && (
            <div className="grid gap-4 pt-2 md:grid-cols-2">
              {event.keyTopics ? (
                <div>
                  <p className="text-sm font-semibold text-foreground">Key topics</p>
                  <p className="mt-1 text-sm text-muted-foreground">{event.keyTopics}</p>
                </div>
              ) : null}
              {event.benefits ? (
                <div>
                  <p className="text-sm font-semibold text-foreground">Benefits</p>
                  <p className="mt-1 text-sm text-muted-foreground">{event.benefits}</p>
                </div>
              ) : null}
              {event.eligibility ? (
                <div className="md:col-span-2">
                  <p className="text-sm font-semibold text-foreground">Eligibility</p>
                  <p className="mt-1 text-sm text-muted-foreground">{event.eligibility}</p>
                </div>
              ) : null}
            </div>
          )}
        </Card>

        <Card className="space-y-4 p-6">
          <h2 className="text-xl font-semibold text-foreground">Event info</h2>
          <div className="space-y-3 text-sm">
            <p><span className="font-semibold text-foreground">Date:</span> <span className="text-muted-foreground">{formatDate(event.eventDate)}</span></p>
            <p><span className="font-semibold text-foreground">Time:</span> <span className="text-muted-foreground">{event.startTime} - {event.endTime}</span></p>
            <p><span className="font-semibold text-foreground">Venue:</span> <span className="text-muted-foreground">{event.venue || "TBA"}</span></p>
            <p><span className="font-semibold text-foreground">Category:</span> <span className="text-muted-foreground">{event.category || "General"}</span></p>
            <p><span className="font-semibold text-foreground">Type:</span> <span className="text-muted-foreground">{event.eventType || "Event"}</span></p>
            <p><span className="font-semibold text-foreground">Registration fee:</span> <span className="text-muted-foreground">{event.registrationFee ? `${event.registrationFee} BDT` : "Free"}</span></p>
            <p><span className="font-semibold text-foreground">Registration deadline:</span> <span className="text-muted-foreground">{formatDateTime(event.registrationDeadline)}</span></p>
            <p><span className="font-semibold text-foreground">Registered:</span> <span className="text-muted-foreground">{event._count?.registrations ?? 0}</span></p>
          </div>
        </Card>
      </section>
    </div>
  );
}

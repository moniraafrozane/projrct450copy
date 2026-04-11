"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EventRegistrationModal } from "@/components/ui/event-registration-modal";
import api, { Event, eventAPI } from "@/lib/api";
import { demoUpcomingEvents } from "@/data/events";

const CATEGORY_ALIAS_MAP: Record<string, string[]> = {
  Tech: ["tech", "technical", "technology"],
  Culture: ["culture", "cultural"],
  Community: ["community", "social", "volunteer"],
  Sports: ["sports", "sport", "athletic"],
  Workshop: ["workshop", "training", "bootcamp"],
  Seminar: ["seminar", "webinar", "lecture", "talk"],
};

const normalizeCategoryText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const matchesSelectedCategory = (event: Event, selectedCategory: string) => {
  if (selectedCategory === "All") return true;

  const aliases = CATEGORY_ALIAS_MAP[selectedCategory] || [selectedCategory.toLowerCase()];
  const searchableText = normalizeCategoryText(`${event.category || ""} ${event.eventType || ""}`);

  return aliases.some((alias) => searchableText.includes(normalizeCategoryText(alias)));
};

export default function StudentDashboardPage() {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>(demoUpcomingEvents);
  const [marketplaceEvents, setMarketplaceEvents] = useState<Event[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [marketplaceError, setMarketplaceError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingEventId, setLoadingEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [userInfo, setUserInfo] = useState({ name: "", email: "", phone: "", studentId: "" });

  useEffect(() => {
    const fetchUpcomingEvents = async () => {
      try {
        const upcomingRes = await api.get("/events", {
          params: { status: "upcoming", limit: 4 },
        });

        setUpcomingEvents(
          upcomingRes.data.events && upcomingRes.data.events.length > 0
            ? upcomingRes.data.events
            : demoUpcomingEvents
        );
      } catch (error) {
        console.error("Error fetching upcoming events:", error);
        setUpcomingEvents(demoUpcomingEvents);
      }
    };

    const fetchUserInfo = async () => {
      try {
        const response = await api.get("/auth/me");
        const user = response.data.user || response.data;
        setUserInfo({
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          studentId: user.studentId || "",
        });
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    };

    fetchUpcomingEvents();
    fetchUserInfo();
  }, []);

  useEffect(() => {
    const fetchMarketplaceEvents = async () => {
      try {
        setMarketplaceLoading(true);
        setMarketplaceError("");

        const params: any = { upcoming: true };
        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
        }

        let events: Event[] = [];

        try {
          const response = await eventAPI.getAllEvents(params);
          events = Array.isArray(response.events) ? response.events : [];
        } catch {
          // Fallback query style to improve compatibility with strict backends.
          const fallbackResponse = await api.get("/events", {
            params: {
              status: "upcoming",
              limit: 200,
              ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
            },
          });
          events = Array.isArray(fallbackResponse.data?.events) ? fallbackResponse.data.events : [];
        }

        const filteredEvents =
          selectedCategory === "All"
            ? events
            : events.filter((event) => matchesSelectedCategory(event, selectedCategory));

        setMarketplaceEvents(filteredEvents);
      } catch (error: any) {
        setMarketplaceError(error.response?.data?.message || "Failed to load events");
        setMarketplaceEvents([]);
      } finally {
        setMarketplaceLoading(false);
      }
    };

    fetchMarketplaceEvents();
  }, [selectedCategory, searchQuery]);

  const handleRegisterEvent = (event: Event) => {
    setSelectedEvent(event);
  };

  const handleRegistrationSubmit = async (registrationData: {
    fullName: string;
    email: string;
    userPhone: string;
    registrationNumber: string;
    teamName: string;
    institution: string;
    remarks: string;
  }) => {
    if (!selectedEvent) return;
    
    setLoadingEventId(selectedEvent.id);
    try {
      const response = await eventAPI.registerForEvent(selectedEvent.id, registrationData);
      alert(`✓ Successfully registered for the event!`);
      setSelectedEvent(null);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Failed to register for event. Please try again.";
      throw new Error(errorMessage);
    } finally {
      setLoadingEventId(null);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const getEventStatus = (event: Event): { label: string; variant: "default" | "accent" | "success" | "warning" | "destructive" | "outline" | null | undefined } => {
    const now = new Date();
    const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : null;

    if (event.status === "cancelled") return { label: "Cancelled", variant: "destructive" };
    if (event.status === "completed") return { label: "Completed", variant: "outline" };
    if (deadline && now > deadline) return { label: "Registration Closed", variant: "outline" };

    if (event.maxParticipants && event._count && event._count.registrations >= event.maxParticipants) {
      return { label: "Full", variant: "outline" };
    }

    if (deadline) {
      const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline <= 3) return { label: "Closing Soon", variant: "warning" };
    }

    return { label: "Open", variant: "success" };
  };

  const categories = ["All", "Tech", "Culture", "Community", "Sports", "Workshop", "Seminar"];

  return (
    <div className="space-y-10">
      <PageHeader
        title="Welcome back"
        description="Track your society submissions, keep tabs on approvals, and explore curated events."
      />

      <SectionCard title="Categories" description="Select a domain to refine event recommendations.">
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 bg-white text-foreground hover:bg-muted"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Event marketplace"
        description="Browse opportunities, register, and follow admin updates in one place."
      >
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
          />
        </div>

        {marketplaceError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {marketplaceError}
          </div>
        )}

        {marketplaceLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading events...</div>
        ) : marketplaceEvents.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No events found. Try adjusting your filters.
          </div>
        ) : (
          <div className="grid gap-4">
            {marketplaceEvents.map((event) => {
              const status = getEventStatus(event);
              const isRegistrationOpen = status.label === "Open" || status.label === "Closing Soon";
              return (
                <div
                  key={event.id}
                  className="flex flex-col gap-4 rounded-2xl border border-border/70 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(event.eventDate)} • {event.startTime} - {event.endTime}
                    </p>
                    <p className="text-sm text-muted-foreground">{event.venue}</p>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <Button
                      variant={isRegistrationOpen ? "default" : "secondary"}
                      disabled={!isRegistrationOpen}
                      onClick={() => handleRegisterEvent(event)}
                    >
                      {isRegistrationOpen ? "Register" : "View Details"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Your upcoming events"
        description="Browse events, apply, and follow progress in one place."
      >
        <div className="grid gap-4">
          {upcomingEvents.map((event) => (
            <div
              key={event.id}
              className="flex flex-col gap-4 rounded-2xl border border-border/70 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-base font-semibold text-foreground">{event.title}</p>
                <p className="text-xl text-muted-foreground">{formatDate(event.eventDate)}</p>
                <p className="text-lg text-muted-foreground">{event.eventType}</p>
                <p className="text-base text-muted-foreground/80">
                  {event.registrationDeadline
                    ? `Register by ${formatDate(event.registrationDeadline)}`
                    : "Registration deadline TBA"}
                </p>
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Badge variant={event.status === "upcoming" ? "success" : "outline"}>
                  {event.status}
                </Badge>
                <Button 
                  variant="outline"
                  onClick={() => handleRegisterEvent(event)}
                  disabled={loadingEventId === event.id}
                >
                  {loadingEventId === event.id ? "Registering..." : "Register Now"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {selectedEvent && (
        <EventRegistrationModal
          event={selectedEvent}
          userPhone={userInfo.phone}
          userRegistrationNumber={userInfo.studentId}
          onClose={() => setSelectedEvent(null)}
          onSubmit={handleRegistrationSubmit}
          isLoading={loadingEventId === selectedEvent.id}
        />
      )}

      {/* Application & history module removed per request */}
    </div>
  );
}

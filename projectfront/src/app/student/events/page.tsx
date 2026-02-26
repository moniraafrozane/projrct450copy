"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { eventAPI, Event } from "@/lib/api";

export default function StudentEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registering, setRegistering] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchEvents();
  }, [selectedCategory, searchQuery]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params: any = { upcoming: true };
      
      if (selectedCategory !== "All") {
        params.category = selectedCategory;
      }
      
      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await eventAPI.getAllEvents(params);
      setEvents(response.events);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (eventId: string) => {
    try {
      setRegistering(eventId);
      setError("");
      
      const response = await eventAPI.registerForEvent(eventId);
      
      if (response.success) {
        alert("Successfully registered for the event!");
        // Refresh events to update registration count
        fetchEvents();
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Failed to register for event";
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setRegistering(null);
    }
  };

  const getEventStatus = (event: Event): { label: string; variant: "default" | "accent" | "success" | "warning" | "destructive" | "outline" | null | undefined } => {
    const now = new Date();
    const eventDate = new Date(event.eventDate);
    const deadline = event.registrationDeadline ? new Date(event.registrationDeadline) : null;
    
    if (event.status === 'cancelled') return { label: 'Cancelled', variant: 'destructive' };
    if (event.status === 'completed') return { label: 'Completed', variant: 'outline' };
    
    if (deadline && now > deadline) return { label: 'Registration Closed', variant: 'outline' };
    
    if (event.maxParticipants && event._count && event._count.registrations >= event.maxParticipants) {
      return { label: 'Full', variant: 'outline' };
    }
    
    if (deadline) {
      const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDeadline <= 3) return { label: 'Closing Soon', variant: 'warning' };
    }
    
    return { label: 'Open', variant: 'success' };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const categories = ["All", "Tech", "Culture", "Community", "Sports", "Workshop", "Seminar"];

  return (
    <div className="space-y-10">
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
        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-base text-foreground"
          />
        </div>

        {error && !registering && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No events found. Try adjusting your filters.
          </div>
        ) : (
          <div className="grid gap-5">
            {events.map((event) => {
              const status = getEventStatus(event);
              const isRegistrationOpen = status.label === 'Open' || status.label === 'Closing Soon';
              const spotsLeft = event.maxParticipants && event._count
                ? event.maxParticipants - event._count.registrations
                : null;

              return (
                <div
                  key={event.id}
                  className="flex flex-col gap-4 rounded-2xl border border-border/70 overflow-hidden"
                >
                  {/* Event Banner Image */}
                  {event.bannerImage && (
                    <div className="relative w-full h-48 md:h-64 overflow-hidden">
                      <img
                        src={event.bannerImage}
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-semibold text-foreground">{event.title}</p>
                            {event.eventType && (
                              <Badge variant="outline">{event.eventType}</Badge>
                            )}
                          </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          🏢 Organized by: {event.organizerName}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          📅 {formatDate(event.eventDate)} • {event.startTime} - {event.endTime}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          📍 {event.venue}
                        </p>
                        {event.speaker && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            🎤 Speaker: {event.speaker}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <p className="mt-3 text-sm text-foreground">
                      {event.description}
                    </p>

                    {event.keyTopics && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key Topics</p>
                        <p className="mt-1 text-sm text-foreground">{event.keyTopics}</p>
                      </div>
                    )}

                    {event.eligibility && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Eligibility</p>
                        <p className="mt-1 text-sm text-foreground">{event.eligibility}</p>
                      </div>
                    )}

                    {event.benefits && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Benefits</p>
                        <p className="mt-1 text-sm text-foreground">{event.benefits}</p>
                      </div>
                    )}

                    {event.registrationDetails && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registration Details</p>
                        <p className="mt-1 text-sm text-foreground">{event.registrationDetails}</p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {event.category && (
                        <Badge variant="outline">{event.category}</Badge>
                      )}
                      <span>
                        💰 {event.registrationFee > 0 ? `৳${event.registrationFee}` : "Free"}
                      </span>
                      {spotsLeft !== null && (
                        <span>
                          🎫 {spotsLeft} spots left
                        </span>
                      )}
                      {event._count && (
                        <span>
                          👥 {event._count.registrations} registered
                        </span>
                      )}
                    </div>

                    {(event.contactInfo || event.organizerContact) && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        📧 Contact: {event.contactInfo || event.organizerContact}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-start gap-3 md:items-end md:min-w-[140px]">
                    <Badge variant={status.variant}>
                      {status.label}
                    </Badge>
                    <Button
                      onClick={() => handleRegister(event.id)}
                      disabled={!isRegistrationOpen || registering === event.id}
                      variant={isRegistrationOpen ? "default" : "secondary"}
                      className="w-full md:w-auto"
                    >
                      {registering === event.id
                        ? "Registering..."
                        : isRegistrationOpen
                        ? "Register"
                        : "View Details"}
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

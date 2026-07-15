"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { eventAPI, Event } from "@/lib/api";
import { EventRegistrationsListModal } from "@/components/ui/event-registrations-list-modal";

type EditableEventFields = {
  title: string;
  venue: string;
  eventDate: string;
  registrationDeadline: string;
  startTime: string;
  endTime: string;
};

const EVENTS_PER_PAGE = 5;

const toDateInputValue = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

export default function SocietyDashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventSearch, setEventSearch] = useState("");
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventError, setEventError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);
  const [draftByEventId, setDraftByEventId] = useState<Record<string, EditableEventFields>>({});
  const [registrationsModalEvent, setRegistrationsModalEvent] = useState<Event | null>(null);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationsError, setRegistrationsError] = useState("");
  const [registrationsTotal, setRegistrationsTotal] = useState<number | null>(null);
  const [registrants, setRegistrants] = useState<{ id: string; userName: string; registrationNumber?: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoadingEvents(true);
        const response = await eventAPI.getManageableEvents();
        const upcomingEvents = (response.events || []).filter((event) => event.status === "upcoming");
        setEvents(upcomingEvents);
      } catch (error: any) {
        setEventError(error.response?.data?.message || "Failed to load events for management");
      } finally {
        setLoadingEvents(false);
      }
    };

    loadEvents();
  }, []);

  const beginEdit = (event: Event) => {
    setEditingEventId(event.id);
    setActionMessage("");
    setEventError("");
    setDraftByEventId((prev) => ({
      ...prev,
      [event.id]: {
        title: event.title || "",
        venue: event.venue || "",
        eventDate: toDateInputValue(event.eventDate),
        registrationDeadline: event.registrationDeadline ? toDateInputValue(event.registrationDeadline) : "",
        startTime: event.startTime?.slice(0, 5) || "",
        endTime: event.endTime?.slice(0, 5) || "",
      },
    }));
  };

  const cancelEdit = () => {
    setEditingEventId(null);
    setEventError("");
  };

  const updateDraftField = (eventId: string, field: keyof EditableEventFields, value: string) => {
    setDraftByEventId((prev) => ({
      ...prev,
      [eventId]: {
        ...(prev[eventId] || { title: "", venue: "", eventDate: "", registrationDeadline: "", startTime: "", endTime: "" }),
        [field]: value,
      },
    }));
  };

  const saveEventChanges = async (eventId: string) => {
    const draft = draftByEventId[eventId];
    if (!draft) return;

    const trimmedTitle = draft.title.trim();
    const trimmedVenue = draft.venue.trim();
    if (!trimmedTitle || !trimmedVenue || !draft.eventDate || !draft.startTime || !draft.endTime) {
      setEventError("Title, venue, date, start time and end time are required");
      return;
    }

    if (draft.startTime >= draft.endTime) {
      setEventError("Start time must be earlier than end time");
      return;
    }

    try {
      setSavingEventId(eventId);
      setEventError("");
      setActionMessage("");

      const response = await eventAPI.updateEvent(eventId, {
        title: trimmedTitle,
        venue: trimmedVenue,
        eventDate: draft.eventDate,
        registrationDeadline: draft.registrationDeadline || undefined,
        startTime: draft.startTime,
        endTime: draft.endTime,
      });

      setEvents((prev) =>
        prev.map((item) =>
          item.id === eventId
            ? {
                ...item,
                ...response.event,
              }
            : item
        )
      );

      setEditingEventId(null);
      setActionMessage("Event updated successfully");
    } catch (error: any) {
      setEventError(error.response?.data?.message || "Failed to update event");
    } finally {
      setSavingEventId(null);
    }
  };

  const viewRegistrationDetails = async (event: Event) => {
    setRegistrationsModalEvent(event);
    setRegistrationsLoading(true);
    setRegistrationsError("");
    setRegistrants([]);
    setRegistrationsTotal(null);

    try {
      const response = await eventAPI.getEventRegistrations(event.id);
      setRegistrants(response.registrations || []);
      setRegistrationsTotal(response.totalRegistrations ?? (response.registrations || []).length);
    } catch (error: any) {
      setRegistrationsError(error.response?.data?.message || "Failed to load registration details");
    } finally {
      setRegistrationsLoading(false);
    }
  };

  const closeRegistrationDetails = () => {
    setRegistrationsModalEvent(null);
    setRegistrationsError("");
    setRegistrants([]);
    setRegistrationsTotal(null);
  };

  const filteredEvents = events.filter((event) =>
    event.title.toLowerCase().includes(eventSearch.trim().toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / EVENTS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedEvents = filteredEvents.slice(
    (safeCurrentPage - 1) * EVENTS_PER_PAGE,
    safeCurrentPage * EVENTS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [eventSearch]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Society mission control"
        description="Start workflows, collaborate with admins and keep every action documented."
      />

      <SectionCard
        title="Event management"
        description="Update event venue, date and time directly from your dashboard."
      >
        {actionMessage && (
          <div className="mb-4 rounded-2xl border border-green-500/50 bg-green-50 px-4 py-3 text-sm text-green-700">
            {actionMessage}
          </div>
        )}

        {eventError && (
          <div className="mb-4 rounded-2xl border border-red-500/50 bg-red-50 px-4 py-3 text-sm text-red-700">
            {eventError}
          </div>
        )}

        <div className="mb-4">
          <input
            type="text"
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            placeholder="Search by event name"
            className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {loadingEvents ? (
          <p className="text-sm text-muted-foreground">Loading events...</p>
        ) : filteredEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events available for management.</p>
        ) : (
          <div className="grid gap-6">
            {paginatedEvents.map((event) => {
              const isEditing = editingEventId === event.id;
              const draft = draftByEventId[event.id];
              const isSaving = savingEventId === event.id;

              return (
                <div
                  key={event.id}
                  className="rounded-3xl border border-border/70 bg-white p-6 shadow-sm transition-all duration-200 hover:border-primary/50 hover:shadow-md sm:p-7"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="text-xl font-bold leading-tight text-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground">Organizer: {event.organizerName}</p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                      {isEditing ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={cancelEdit}
                            disabled={isSaving}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => saveEventChanges(event.id)}
                            disabled={isSaving}
                          >
                            {isSaving ? "Saving..." : "Save"}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" onClick={() => viewRegistrationDetails(event)}>
                            Registration Details
                          </Button>
                          <Button variant="secondary" onClick={() => beginEdit(event)}>
                            Edit
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 border-t border-border/60 pt-6 md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm md:col-span-2">
                      <span className="font-medium text-foreground">Event Name</span>
                      <input
                        type="text"
                        value={isEditing ? draft?.title || "" : event.title}
                        onChange={(e) => updateDraftField(event.id, "title", e.target.value)}
                        disabled={!isEditing || isSaving}
                        className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground disabled:opacity-60"
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm">
                      <span className="font-medium text-foreground">Venue</span>
                      <input
                        type="text"
                        value={isEditing ? draft?.venue || "" : event.venue}
                        onChange={(e) => updateDraftField(event.id, "venue", e.target.value)}
                        disabled={!isEditing || isSaving}
                        className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground disabled:opacity-60"
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm">
                      <span className="font-medium text-foreground">Event Date</span>
                      <input
                        type="date"
                        value={isEditing ? draft?.eventDate || "" : toDateInputValue(event.eventDate)}
                        onChange={(e) => updateDraftField(event.id, "eventDate", e.target.value)}
                        disabled={!isEditing || isSaving}
                        className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground disabled:opacity-60"
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm">
                      <span className="font-medium text-foreground">Registration Deadline</span>
                      <input
                        type="date"
                        value={
                          isEditing
                            ? draft?.registrationDeadline || ""
                            : event.registrationDeadline
                            ? toDateInputValue(event.registrationDeadline)
                            : ""
                        }
                        onChange={(e) => updateDraftField(event.id, "registrationDeadline", e.target.value)}
                        disabled={!isEditing || isSaving}
                        className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground disabled:opacity-60"
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm">
                      <span className="font-medium text-foreground">Start Time</span>
                      <input
                        type="time"
                        value={isEditing ? draft?.startTime || "" : event.startTime?.slice(0, 5) || ""}
                        onChange={(e) => updateDraftField(event.id, "startTime", e.target.value)}
                        disabled={!isEditing || isSaving}
                        className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground disabled:opacity-60"
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm">
                      <span className="font-medium text-foreground">End Time</span>
                      <input
                        type="time"
                        value={isEditing ? draft?.endTime || "" : event.endTime?.slice(0, 5) || ""}
                        onChange={(e) => updateDraftField(event.id, "endTime", e.target.value)}
                        disabled={!isEditing || isSaving}
                        className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground disabled:opacity-60"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loadingEvents && filteredEvents.length > 0 && totalPages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
            <p className="text-sm text-muted-foreground">
              Page {safeCurrentPage} of {totalPages} • {filteredEvents.length} event
              {filteredEvents.length === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safeCurrentPage === 1}
              >
                Previous
              </Button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === safeCurrentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safeCurrentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </SectionCard>

      {registrationsModalEvent && (
        <EventRegistrationsListModal
          eventTitle={registrationsModalEvent.title}
          totalRegistrations={registrationsTotal}
          registrants={registrants}
          isLoading={registrationsLoading}
          error={registrationsError}
          onClose={closeRegistrationDetails}
        />
      )}
    </div>
  );
}

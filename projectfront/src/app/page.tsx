"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api, { Event } from "@/lib/api";
import { demoUpcomingEvents } from "@/data/events";

export default function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [ongoingEvents, setOngoingEvents] = useState<Event[]>([]);
  const [completedEvents, setCompletedEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      
      // Fetch upcoming events
      const upcomingRes = await api.get('/events', { 
        params: { status: 'upcoming', limit: 3 } 
      });
      
      // Fetch ongoing events
      const ongoingRes = await api.get('/events', { 
        params: { status: 'ongoing', limit: 3 } 
      });
      
      // Fetch completed events
      const completedRes = await api.get('/events', { 
        params: { status: 'completed', limit: 3 } 
      });

      // Use API data if available, otherwise use demo data for upcoming events
      setUpcomingEvents(
        upcomingRes.data.events && upcomingRes.data.events.length > 0 
          ? upcomingRes.data.events 
          : []
      );
      setOngoingEvents(
        ongoingRes.data.events && ongoingRes.data.events.length > 0 
          ? ongoingRes.data.events 
          : []
      );
      setCompletedEvents(
        completedRes.data.events && completedRes.data.events.length > 0 
          ? completedRes.data.events 
          : []
      );
    } catch (error) {
      console.error('Error fetching events:', error);
      // On error, show demo events for upcoming, ongoing, and completed
      setUpcomingEvents([]);
      setOngoingEvents([]);
      setCompletedEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const EventCard = ({ event }: { event: Event }) => (
    <Link href={`/events/${event.id}`} className="block h-full">
      <Card className="flex h-full flex-col overflow-hidden transition-all hover:shadow-lg">
        {event.bannerImage && (
          <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5">
            <img
              src={event.bannerImage}
              alt={event.title}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        )}
        {!event.bannerImage && (
          <div className="h-48 w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <span className="text-4xl">.</span>
          </div>
        )}
        <div className="flex flex-1 flex-col space-y-3 p-6">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-lg line-clamp-2">{event.title}</h3>
            <Badge variant={
              event.status === 'upcoming' ? 'default' :
              event.status === 'ongoing' ? 'accent' :
              'outline'
            }>
              {event.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {event.description}
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground"> {formatDate(event.eventDate)}</span>
            <span className="text-muted-foreground"> {event.venue}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">⏰ {event.startTime} - {event.endTime}</span>
            {event._count && (
              <span className="text-muted-foreground">
                👥 {event._count.registrations} registered
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/95 via-primary to-primary/90 px-8 py-10 text-primary-foreground shadow-xl">
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            CSE Society Budget and Event Management System
          </h1>
          <p className="text-base text-primary-foreground/80 md:text-xl md:w-3/4">
            Welcome to CSE Society—collaborate across budgeting, events and approvals in one guided workspace.
          </p>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold"> Upcoming Events</h2>
            <p className="text-muted-foreground">Don&apos;t miss out on these exciting events!</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/events?status=upcoming">View All</Link>
          </Button>
        </div>
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="h-96 animate-pulse bg-muted"></Card>
            ))}
          </div>
        ) : upcomingEvents.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            No upcoming events at the moment. Check back soon!
          </Card>
        )}
      </section>

      {/* Ongoing Events */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold"> Ongoing Events</h2>
            <p className="text-muted-foreground">Currently happening now!</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/events?status=ongoing">View All</Link>
          </Button>
        </div>
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="h-96 animate-pulse bg-muted"></Card>
            ))}
          </div>
        ) : ongoingEvents.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ongoingEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            No live events at the moment.
          </Card>
        )}
      </section>

      {/* Completed Events */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold"> Past Events</h2>
            <p className="text-muted-foreground">Check out what we&apos;ve accomplished!</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/events?status=completed">View All</Link>
          </Button>
        </div>
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="h-96 animate-pulse bg-muted"></Card>
            ))}
          </div>
        ) : completedEvents.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {completedEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center text-muted-foreground">
            No completed events yet.
          </Card>
        )}
      </section>
    </div>
  );
}

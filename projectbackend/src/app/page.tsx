"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import api, { Event } from "@/lib/api";
import { demoUpcomingEvents } from "@/data/events";

// Demo ongoing/live events
const demoOngoingEvents: Event[] = [
  {
    id: "demo-live-1",
    title: "Tech Talk: Cloud Computing & DevOps",
    description: "Live session with industry experts discussing cloud infrastructure, containerization, and modern DevOps practices. Interactive Q&A happening now!",
    eventType: "Seminar",
    category: "Technical",
    venue: "CSE lab 629",
    eventDate: "2026-02-07",
    startTime: "14:00",
    endTime: "17:00",
    speaker: "Alex Kumar - Senior Cloud Architect at CloudTech Inc.",
    eligibility: "All students",
    keyTopics: "AWS, Docker, Kubernetes, CI/CD",
    benefits: "Industry Insights, Networking, Q&A Session",
    maxParticipants: 150,
    registrationDeadline: "2026-02-07",
    registrationFee: 0,
    organizerId: "cse-society",
    organizerName: "CSE Society",
    organizerContact: "events@cse.edu",
    status: "ongoing",
    isPublished: true,
    bannerImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=400&fit=crop",
    createdAt: "2026-02-05T00:00:00.000Z",
    updatedAt: "2026-02-07T00:00:00.000Z",
    _count: { registrations: 123 }
  },
  {
    id: "demo-live-2",
    title: "Coding Competition Round 2",
    description: "The second round of our annual coding competition is live! Participants are solving algorithmic challenges. Spectators welcome to watch and learn!",
    eventType: "Competition",
    category: "Technical",
    venue: "CSE lab 303 and 304",
    eventDate: "2026-02-07",
    startTime: "10:00",
    endTime: "18:00",
    speaker: "Competition Judges Panel",
    eligibility: "Registered participants only",
    keyTopics: "Data Structures, Algorithms, Problem Solving",
    benefits: "Prizes, Recognition, Experience",
    maxParticipants: 80,
    registrationDeadline: "2026-02-01",
    registrationFee: 0,
    organizerId: "cse-society",
    organizerName: "CSE Society",
    organizerContact: "competition@cse.edu",
    status: "ongoing",
    isPublished: true,
    bannerImage: "https://images.unsplash.com/photo-1580894732444-8ecded7900cd?w=800&h=400&fit=crop",
    createdAt: "2026-01-20T00:00:00.000Z",
    updatedAt: "2026-02-07T00:00:00.000Z",
    _count: { registrations: 76 }
  }
];

// Demo completed/past events
const demoCompletedEvents: Event[] = [
  {
    id: "demo-completed-1",
    title: "Python Programming Bootcamp",
    description: "Successfully completed 3-day intensive Python bootcamp. Students learned fundamentals, data structures, and built real-world projects.",
    eventType: "Workshop",
    category: "Technical",
    venue: "CSE lab 304",
    eventDate: "2026-01-25",
    startTime: "09:00",
    endTime: "17:00",
    speaker: "Prof. Emily Chen - Python Developer & Educator",
    eligibility: "All CSE students",
    keyTopics: "Python Basics, Data Structures, Web Scraping",
    benefits: "Certificate, Code Repository, Project Portfolio",
    maxParticipants: 50,
    registrationDeadline: "2026-01-20",
    registrationFee: 0,
    organizerId: "cse-society",
    organizerName: "CSE Society",
    organizerContact: "python@cse.edu",
    status: "completed",
    isPublished: true,
    bannerImage: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=800&h=400&fit=crop",
    createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-25T00:00:00.000Z",
    _count: { registrations: 48 }
  },
  {
    id: "demo-completed-2",
    title: "Blockchain & Cryptocurrency Seminar",
    description: "Insightful seminar on blockchain technology, smart contracts, and the future of decentralized finance. Great turnout and engagement!",
    eventType: "Seminar",
    category: "Technical",
    venue: "Gallery 2",
    eventDate: "2026-01-18",
    startTime: "15:00",
    endTime: "18:00",
    speaker: "Raj Patel - Blockchain Consultant",
    eligibility: "All students",
    keyTopics: "Blockchain, Smart Contracts, DeFi, NFTs",
    benefits: "Industry Insights, Networking, Certificate",
    maxParticipants: 120,
    registrationDeadline: "2026-01-15",
    registrationFee: 0,
    organizerId: "cse-society",
    organizerName: "CSE Society",
    organizerContact: "blockchain@cse.edu",
    status: "completed",
    isPublished: true,
    bannerImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&h=400&fit=crop",
    createdAt: "2026-01-05T00:00:00.000Z",
    updatedAt: "2026-01-18T00:00:00.000Z",
    _count: { registrations: 115 }
  },
  {
    id: "demo-completed-3",
    title: "UI/UX Design Workshop",
    description: "Hands-on workshop covering design principles, user research, wireframing, and prototyping. Students created amazing portfolios!",
    eventType: "Workshop",
    category: "Design",
    venue: "Gallery 2",
    eventDate: "2026-01-10",
    startTime: "10:00",
    endTime: "16:00",
    speaker: "Priya Sharma - Senior UX Designer at DesignCo",
    eligibility: "All students interested in design",
    keyTopics: "Design Thinking, Figma, Prototyping, User Research",
    benefits: "Portfolio Projects, Certificate, Tools Access",
    maxParticipants: 40,
    registrationDeadline: "2026-01-07",
    registrationFee: 0,
    organizerId: "cse-society",
    organizerName: "CSE Society",
    organizerContact: "design@cse.edu",
    status: "completed",
    isPublished: true,
    bannerImage: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=400&fit=crop",
    createdAt: "2025-12-20T00:00:00.000Z",
    updatedAt: "2026-01-10T00:00:00.000Z",
    _count: { registrations: 38 }
  }
];

export default function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>(demoUpcomingEvents);
  const [ongoingEvents, setOngoingEvents] = useState<Event[]>(demoOngoingEvents);
  const [completedEvents, setCompletedEvents] = useState<Event[]>(demoCompletedEvents);
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
          : demoUpcomingEvents
      );
      setOngoingEvents(
        ongoingRes.data.events && ongoingRes.data.events.length > 0 
          ? ongoingRes.data.events 
          : demoOngoingEvents
      );
      setCompletedEvents(
        completedRes.data.events && completedRes.data.events.length > 0 
          ? completedRes.data.events 
          : demoCompletedEvents
      );
    } catch (error) {
      console.error('Error fetching events:', error);
      // On error, show demo events for upcoming, ongoing, and completed
      setUpcomingEvents(demoUpcomingEvents);
      setOngoingEvents(demoOngoingEvents);
      setCompletedEvents(demoCompletedEvents);
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
    <Card className="overflow-hidden transition-all hover:shadow-lg">
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
      <div className="p-6 space-y-3">
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
  );

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/95 via-primary to-primary/90 px-8 py-14 text-primary-foreground shadow-xl">
        <div className="space-y-6">
          <h1 className="text-5xl font-semibold leading-tight md:text-6xl">
            CSE Society Budget and Event Management System
          </h1>
          <p className="text-lg text-primary-foreground/80 md:text-xl md:w-3/4">
            Welcome to CSE Society—collaborate across budgeting, events, and approvals in one guided workspace.
          </p>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold"> Upcoming Events</h2>
            <p className="text-muted-foreground">Don't miss out on these exciting events!</p>
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
            <p className="text-muted-foreground">Check out what we've accomplished!</p>
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

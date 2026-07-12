/**
 * Seeds a "budget_breakdown" society application for every event that doesn't
 * already have one, filling in several realistic dummy purposes/categories
 * (Catering, Venue, Decoration, ...) instead of just a single line item.
 * Safe to re-run — skips events that already have a budget_breakdown application.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PURPOSE_TEMPLATES = [
  { title: 'Venue Rental', helper: 'Hall/auditorium booking charges', share: 0.25 },
  { title: 'Catering', helper: 'Refreshments and meals for attendees', share: 0.2 },
  { title: 'Decoration', helper: 'Stage, banners and venue decoration', share: 0.1 },
  { title: 'Printing & Promotion', helper: 'Posters, banners, certificates', share: 0.1 },
  { title: 'Transportation', helper: 'Guest and equipment transport', share: 0.1 },
  { title: 'Prizes & Certificates', helper: 'Winner prizes and participation certificates', share: 0.15 },
  { title: 'Miscellaneous', helper: 'Contingency and other small expenses', share: 0.1 },
];

function buildSections(baseBudget) {
  return PURPOSE_TEMPLATES.map((template, index) => ({
    key: `cat-seed-${index}`,
    title: template.title,
    helper: template.helper,
    amount: Math.round((baseBudget * template.share) / 100) * 100,
    notes: '',
    optional: false,
  }));
}

async function main() {
  const events = await prisma.event.findMany({
    select: {
      id: true,
      title: true,
      eventDate: true,
      startTime: true,
      venue: true,
      organizerId: true,
      organizerName: true,
      registrationFee: true,
      maxParticipants: true,
    },
  });

  console.log(`Found ${events.length} events.`);

  const existing = await prisma.societyApplication.findMany({
    where: { type: 'budget_breakdown' },
    select: { content: true },
  });
  const eventsWithBudget = new Set(
    existing.map((application) => application.content?.eventId).filter(Boolean)
  );
  console.log(`Skipping ${eventsWithBudget.size} events that already have a budget breakdown.`);

  let created = 0;

  for (const event of events) {
    if (eventsWithBudget.has(event.id)) continue;

    // Rough baseline budget scaled by expected participants, with a sane floor.
    const baseBudget = Math.max(20000, (event.maxParticipants || 50) * 300);
    const sections = buildSections(baseBudget);
    const totalAmount = sections.reduce((sum, section) => sum + section.amount, 0);

    await prisma.societyApplication.create({
      data: {
        type: 'budget_breakdown',
        subject: `Additional Budget Breakdown — Application for approval of additional budget for ${event.title}`,
        content: {
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.eventDate,
          eventStartTime: event.startTime,
          eventVenue: event.venue,
          organizerName: event.organizerName,
          sections,
          calculatedTotal: totalAmount,
          overrideAmount: null,
          totalAmount,
        },
        createdById: event.organizerId,
        createdByName: event.organizerName,
        status: 'draft',
      },
    });

    console.log(`Created budget breakdown for: ${event.title} (BDT ${totalAmount})`);
    created += 1;
  }

  console.log(`\nDone. Created ${created} new budget breakdown application(s).`);
}

main()
  .catch((error) => {
    console.error('Error seeding budget breakdowns:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

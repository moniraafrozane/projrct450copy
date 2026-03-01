const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedEvents() {
  try {
    console.log('🌱 Starting to seed demo events...');

    // Find or create a demo organizer user
    let organizer = await prisma.user.findFirst({
      where: { role: 'society' }
    });

    if (!organizer) {
      console.log('Creating demo organizer...');
      organizer = await prisma.user.create({
        data: {
          name: 'CSE Society Admin',
          email: 'cse.society@university.edu',
          password: '$2a$10$demoPasswordHashedValue123456789',
          role: 'society',
          societyName: 'CSE Society',
          societyRole: 'President',
          isActive: true,
          isEmailVerified: true
        }
      });
    }

    const organizerId = organizer.id;

    // Upcoming Events (future dates)
    const upcomingEvents = [
      {
        title: 'AI & Machine Learning Workshop',
        description: 'Hands-on workshop covering fundamentals of AI and ML using Python and TensorFlow. Learn to build your first neural network and understand deep learning concepts.',
        eventType: 'Workshop',
        category: 'Technical',
        venue: 'CSE Lab 301',
        eventDate: new Date('2026-02-15'),
        startTime: '10:00 AM',
        endTime: '04:00 PM',
        speaker: 'Dr. Sarah Johnson - AI Research Scientist',
        eligibility: 'All CSE students',
        keyTopics: 'Neural Networks, TensorFlow, Deep Learning, Computer Vision',
        benefits: 'Certificate of participation, Workshop materials, Networking opportunities',
        maxParticipants: 50,
        registrationDeadline: new Date('2026-02-12'),
        registrationFee: 0,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'cse.events@university.edu',
        status: 'upcoming',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800'
      },
      {
        title: 'Hackathon 2026: Code for Change',
        description: '24-hour hackathon focused on building solutions for social problems. Team up, code, and compete for exciting prizes!',
        eventType: 'Competition',
        category: 'Hackathon',
        venue: 'CSE Auditorium & Labs',
        eventDate: new Date('2026-02-20'),
        startTime: '09:00 AM',
        endTime: '09:00 AM',
        speaker: 'Industry Mentors from Tech Companies',
        eligibility: 'Undergraduate students (teams of 2-4)',
        keyTopics: 'Full-stack Development, Problem Solving, Innovation, Teamwork',
        benefits: 'Cash prizes up to $5000, Internship opportunities, Swag and goodies',
        maxParticipants: 100,
        registrationDeadline: new Date('2026-02-18'),
        registrationFee: 10,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'hackathon@cse-society.edu',
        status: 'upcoming',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800'
      },
      {
        title: 'Cybersecurity Seminar: Protecting Digital Assets',
        description: 'Learn about the latest cybersecurity threats and defense mechanisms. Topics include ethical hacking, network security, and data protection.',
        eventType: 'Seminar',
        category: 'Security',
        venue: 'Main Auditorium',
        eventDate: new Date('2026-02-25'),
        startTime: '02:00 PM',
        endTime: '05:00 PM',
        speaker: 'Prof. Michael Chen - Cybersecurity Expert',
        eligibility: 'All engineering students',
        keyTopics: 'Ethical Hacking, Network Security, Cryptography, Security Best Practices',
        benefits: 'Certificate, Study materials, Q&A session',
        maxParticipants: 150,
        registrationDeadline: new Date('2026-02-23'),
        registrationFee: 0,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'security@cse-society.edu',
        status: 'upcoming',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800'
      },
      {
        title: 'Web Development Bootcamp',
        description: 'Intensive 3-day bootcamp covering modern web development with React, Node.js, and MongoDB. Build and deploy a full-stack application.',
        eventType: 'Bootcamp',
        category: 'Technical',
        venue: 'CSE Lab 201-203',
        eventDate: new Date('2026-03-05'),
        startTime: '09:00 AM',
        endTime: '06:00 PM',
        speaker: 'Team of Industry Professionals',
        eligibility: 'Students with basic programming knowledge',
        keyTopics: 'React.js, Node.js, Express, MongoDB, REST APIs, Deployment',
        benefits: 'Certificate, Project portfolio, Career guidance',
        maxParticipants: 40,
        registrationDeadline: new Date('2026-03-01'),
        registrationFee: 25,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'webdev@cse-society.edu',
        status: 'upcoming',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1593720213428-28a5b9e94613?w=800'
      },
      {
        title: 'Intra SUST Programming Contest',
        description: 'Annual programming contest for SUST students! Solve challenging algorithmic problems, compete with the best programmers, and win exciting prizes. This is the premier competitive programming event of the university.',
        eventType: 'Competition',
        category: 'Programming',
        venue: 'SUST Central Auditorium',
        eventDate: new Date('2026-02-18'),
        startTime: '10:00 AM',
        endTime: '03:00 PM',
        speaker: 'ICPC World Finalists & Programming Champions',
        eligibility: 'All SUST students (Individual participation)',
        keyTopics: 'Algorithms, Data Structures, Problem Solving, Competitive Programming',
        benefits: 'Cash prizes: 1st-BDT 50,000, 2nd-BDT 30,000, 3rd-BDT 20,000, Certificate, Programming resources',
        maxParticipants: 200,
        registrationDeadline: new Date('2026-02-15'),
        registrationFee: 0,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+880-1711-123456',
        contactInfo: 'programming@sust.edu',
        status: 'upcoming',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800'
      },
      {
        title: 'VisionX Robotics Competition',
        description: 'Showcase your robotics skills in this exciting competition! Build autonomous robots to complete challenging tasks. Categories include line following, maze solving, and obstacle avoidance. Bring your innovative ideas to life!',
        eventType: 'Competition',
        category: 'Robotics',
        venue: 'SUST Engineering Complex - Hall A',
        eventDate: new Date('2026-02-22'),
        startTime: '09:00 AM',
        endTime: '06:00 PM',
        speaker: 'Robotics Engineers from BUET & Industry Experts',
        eligibility: 'All university students (Teams of 2-4 members)',
        keyTopics: 'Robotics, Automation, Arduino, Sensors, Motor Control, Path Planning',
        benefits: 'Prizes up to BDT 1,00,000, Certificates, Robotics kits, Industry exposure',
        maxParticipants: 80,
        registrationDeadline: new Date('2026-02-19'),
        registrationFee: 500,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+880-1711-123456',
        contactInfo: 'visionx@sust.edu',
        status: 'upcoming',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800'
      },
      {
        title: 'JavaFest',
        description: 'The biggest Java programming festival in Bangladesh! Participate in Java-focused workshops, coding competitions, and tech talks. Learn Spring Boot, microservices, and enterprise Java development from industry leaders.',
        eventType: 'Festival',
        category: 'Programming',
        venue: 'SUST Campus Wide Event',
        eventDate: new Date('2026-03-10'),
        startTime: '08:00 AM',
        endTime: '08:00 PM',
        speaker: 'Java Champions, Oracle Developers, Senior Engineers from Java Community',
        eligibility: 'All students and professionals interested in Java',
        keyTopics: 'Java, Spring Boot, Microservices, JVM, Enterprise Development, Cloud Native Java',
        benefits: 'National recognition, Prizes worth BDT 2,00,000, Certificates, Career opportunities, Networking',
        maxParticipants: 500,
        registrationDeadline: new Date('2026-03-07'),
        registrationFee: 200,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+880-1711-123456',
        contactInfo: 'javafest@sust.edu',
        status: 'upcoming',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800'
      }
    ];

    // Ongoing Events (happening today)
    const ongoingEvents = [
      {
        title: 'Open Source Contribution Drive',
        description: 'Week-long event where students contribute to open-source projects. Get guidance from mentors and make your first PR!',
        eventType: 'Workshop',
        category: 'Open Source',
        venue: 'Online & CSE Lab 102',
        eventDate: new Date('2026-02-03'),
        startTime: '10:00 AM',
        endTime: '08:00 PM',
        speaker: 'Open Source Maintainers & Contributors',
        eligibility: 'All students',
        keyTopics: 'Git, GitHub, Open Source, Pull Requests, Code Review',
        benefits: 'GitHub profile boost, Mentorship, Community recognition',
        maxParticipants: 80,
        registrationDeadline: new Date('2026-02-01'),
        registrationFee: 0,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'opensource@cse-society.edu',
        status: 'ongoing',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1618401479427-c8ef9465fbe1?w=800'
      },
      {
        title: 'Tech Talk: Career in Cloud Computing',
        description: 'Live talk session with cloud architects from leading companies. Learn about cloud technologies, certifications, and career paths.',
        eventType: 'Talk',
        category: 'Career',
        venue: 'Seminar Hall B',
        eventDate: new Date('2026-02-06'),
        startTime: '03:00 PM',
        endTime: '05:00 PM',
        speaker: 'Cloud Architects from AWS, Azure, and GCP',
        eligibility: 'Final year and pre-final year students',
        keyTopics: 'Cloud Computing, AWS, Azure, GCP, Certifications, Career paths',
        benefits: 'Career guidance, Networking, Free cloud credits',
        maxParticipants: 100,
        registrationDeadline: new Date('2026-02-05'),
        registrationFee: 0,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'career@cse-society.edu',
        status: 'ongoing',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800'
      },
      {
        title: 'Code Debugging Challenge',
        description: 'Real-time debugging competition where participants solve coding bugs and errors. Test your debugging skills and win prizes!',
        eventType: 'Competition',
        category: 'Programming',
        venue: 'CSE Lab 401',
        eventDate: new Date('2026-02-06'),
        startTime: '11:00 AM',
        endTime: '02:00 PM',
        speaker: 'N/A',
        eligibility: 'All CSE students',
        keyTopics: 'Debugging, Problem Solving, Code Analysis, Error Handling',
        benefits: 'Prizes for top 3, Certificate, Debugging tools swag',
        maxParticipants: 60,
        registrationDeadline: new Date('2026-02-05'),
        registrationFee: 5,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'competitions@cse-society.edu',
        status: 'ongoing',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800'
      },
      {
        title: 'Git & GitHub Mastery Workshop',
        description: 'Live hands-on workshop teaching version control with Git and GitHub. Learn branching, merging, pull requests, and collaborative development workflows.',
        eventType: 'Workshop',
        category: 'Technical',
        venue: 'CSE Lab 301',
        eventDate: new Date('2026-02-06'),
        startTime: '09:00 AM',
        endTime: '01:00 PM',
        speaker: 'GitHub Campus Experts & Open Source Contributors',
        eligibility: 'All students',
        keyTopics: 'Git, GitHub, Version Control, Collaboration, CI/CD Basics',
        benefits: 'Certificate, GitHub Pro access, Git cheat sheet',
        maxParticipants: 70,
        registrationDeadline: new Date('2026-02-05'),
        registrationFee: 0,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'git@cse-society.edu',
        status: 'ongoing',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=800'
      },
      {
        title: 'Python Data Science Live Session',
        description: 'Interactive session on data analysis and visualization using Python. Work with real datasets using Pandas, NumPy, and Matplotlib.',
        eventType: 'Workshop',
        category: 'Data Science',
        venue: 'Online (Zoom) + CSE Lab 202',
        eventDate: new Date('2026-02-06'),
        startTime: '02:00 PM',
        endTime: '06:00 PM',
        speaker: 'Data Scientists from Tech Industry',
        eligibility: 'Students with basic Python knowledge',
        keyTopics: 'Python, Pandas, NumPy, Matplotlib, Data Analysis, Visualization',
        benefits: 'Certificate, Dataset collection, Jupyter notebooks',
        maxParticipants: 90,
        registrationDeadline: new Date('2026-02-05'),
        registrationFee: 0,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'datascience@cse-society.edu',
        status: 'ongoing',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800'
      }
    ];

    // Completed Events (past dates)
    const completedEvents = [
      {
        title: 'Data Structures & Algorithms Marathon',
        description: 'Intensive DSA problem-solving session. Students solved 50+ problems across various difficulty levels.',
        eventType: 'Workshop',
        category: 'Competitive Programming',
        venue: 'CSE Lab 101',
        eventDate: new Date('2026-01-15'),
        startTime: '10:00 AM',
        endTime: '06:00 PM',
        speaker: 'Competitive Programming Experts',
        eligibility: 'All CSE students',
        keyTopics: 'Arrays, Trees, Graphs, Dynamic Programming, Greedy Algorithms',
        benefits: 'Certificate, Problem-solving resources',
        maxParticipants: 70,
        registrationDeadline: new Date('2026-01-12'),
        registrationFee: 0,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'dsa@cse-society.edu',
        status: 'completed',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800'
      },
      {
        title: 'Mobile App Development Workshop',
        description: 'Built Android and iOS applications using React Native. Participants created and deployed their first mobile app.',
        eventType: 'Workshop',
        category: 'Mobile Development',
        venue: 'CSE Lab 202',
        eventDate: new Date('2026-01-20'),
        startTime: '09:00 AM',
        endTime: '05:00 PM',
        speaker: 'Mobile App Developers from Industry',
        eligibility: 'Students with JavaScript knowledge',
        keyTopics: 'React Native, Mobile UI/UX, API Integration, App Deployment',
        benefits: 'Certificate, Project code, App store publishing guide',
        maxParticipants: 45,
        registrationDeadline: new Date('2026-01-18'),
        registrationFee: 15,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'mobile@cse-society.edu',
        status: 'completed',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800'
      },
      {
        title: 'Blockchain & Cryptocurrency Seminar',
        description: 'Explored blockchain technology, smart contracts, and cryptocurrency. Hands-on session with Ethereum and Solidity.',
        eventType: 'Seminar',
        category: 'Emerging Tech',
        venue: 'Main Auditorium',
        eventDate: new Date('2026-01-28'),
        startTime: '02:00 PM',
        endTime: '06:00 PM',
        speaker: 'Blockchain Developers and Crypto Experts',
        eligibility: 'All engineering students',
        keyTopics: 'Blockchain, Smart Contracts, Ethereum, DeFi, NFTs',
        benefits: 'Certificate, Blockchain resources, Free testnet tokens',
        maxParticipants: 120,
        registrationDeadline: new Date('2026-01-25'),
        registrationFee: 0,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'blockchain@cse-society.edu',
        status: 'completed',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800'
      },
      {
        title: 'UI/UX Design Workshop',
        description: 'Learned principles of user interface and user experience design. Created design prototypes using Figma.',
        eventType: 'Workshop',
        category: 'Design',
        venue: 'Design Lab',
        eventDate: new Date('2026-02-01'),
        startTime: '10:00 AM',
        endTime: '04:00 PM',
        speaker: 'UX Designers from Tech Startups',
        eligibility: 'All students interested in design',
        keyTopics: 'UI/UX Principles, Figma, Prototyping, User Research, Design Thinking',
        benefits: 'Certificate, Figma Pro trial, Design resources',
        maxParticipants: 35,
        registrationDeadline: new Date('2026-01-29'),
        registrationFee: 10,
        organizerId: organizerId,
        organizerName: 'CSE Society',
        organizerContact: '+1-555-0123',
        contactInfo: 'design@cse-society.edu',
        status: 'completed',
        isPublished: true,
        bannerImage: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800'
      }
    ];

    // Insert all events
    const allEvents = [...upcomingEvents, ...ongoingEvents, ...completedEvents];
    
    for (const eventData of allEvents) {
      await prisma.event.create({
        data: eventData
      });
      console.log(`✅ Created: ${eventData.title} (${eventData.status})`);
    }

    console.log(`\n🎉 Successfully seeded ${allEvents.length} demo events!`);
    console.log(`   - ${upcomingEvents.length} upcoming events (including Intra SUST Programming Contest, VisionX Robotics Competition, JavaFest)`);
    console.log(`   - ${ongoingEvents.length} ongoing events (live now!)`);
    console.log(`   - ${completedEvents.length} completed events`);

  } catch (error) {
    console.error('❌ Error seeding events:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedEvents()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

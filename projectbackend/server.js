require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const prisma = require('./config/prisma');
const errorHandler = require('./middleware/errorHandler');

// Initialize express app
const app = express();

// Test database connection
async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('PostgreSQL Connected successfully');
  } catch (error) {
    console.error('PostgreSQL connection error:', error.message);
    process.exit(1);
  }
}

testDatabaseConnection();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
const _postEventsModule = require('./routes/postEvents');
app.use('/api/events/:eventId', _postEventsModule);                     // post-event reporting (event-scoped)
app.use('/api/post-event-reports', _postEventsModule.standaloneRouter); // all-reports + generic template
app.use('/api/admin/reports', require('./routes/adminReports'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/positions', require('./routes/positions'));
app.use('/api/committees', require('./routes/committee'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/student-affairs', require('./routes/studentAffairs'));
app.use('/api/vouchers', require('./routes/vouchers'));
app.use('/api/admin/audit-logs', require('./routes/auditLog'));

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(1);
  });
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;

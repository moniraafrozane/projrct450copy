const { PrismaClient } = require('@prisma/client');

// Create a singleton instance of PrismaClient
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // In development, use a global variable to preserve the client across module reloads (hot reload)
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

module.exports = prisma;

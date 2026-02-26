const prisma = require('./prisma');

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log(`PostgreSQL Connected via Prisma`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

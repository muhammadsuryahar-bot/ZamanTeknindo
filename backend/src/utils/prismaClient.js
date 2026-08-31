const { PrismaClient } = require("@prisma/client");

// Vercel/serverless dapat membuat lebih dari satu instance function.
// Simpan Prisma Client di globalThis agar pada warm instance kita tidak
// membuat client baru setiap kali module di-evaluate ulang.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__zamanTeknindoPrisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__zamanTeknindoPrisma = prisma;
} else if (!globalForPrisma.__zamanTeknindoPrisma) {
  // Tetap expose instance pada warm production instance.
  globalForPrisma.__zamanTeknindoPrisma = prisma;
}

module.exports = prisma;

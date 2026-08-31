const { PrismaClient } = require("@prisma/client");

// Vercel/serverless dapat membuat lebih dari satu instance function.
// Pada setiap instance, gunakan satu PrismaClient yang sama selama instance
// tersebut masih hidup agar tidak membuat client baru untuk setiap import.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__zamanTeknindoPrisma || new PrismaClient();

// Simpan referensi global agar warm invocation memakai client yang sama.
globalForPrisma.__zamanTeknindoPrisma = prisma;

module.exports = prisma;

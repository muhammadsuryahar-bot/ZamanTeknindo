const { PrismaClient } = require("@prisma/client");

// Satu koneksi Prisma dipakai bersama di seluruh aplikasi
const prisma = new PrismaClient();

module.exports = prisma;

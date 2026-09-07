const { PrismaClient } = require("@prisma/client");

// Vercel/serverless dapat membuat lebih dari satu instance function.
// Simpan Prisma Client di globalThis agar pada warm instance kita tidak
// membuat client baru setiap kali module di-evaluate ulang.
const globalForPrisma = globalThis;

function buatDatabaseUrlRuntime() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  try {
    const url = new URL(raw);

    // Production memakai Supavisor transaction pooler (6543).
    // Prisma perlu pgbouncer=true pada mode transaction pooling.
    if (url.port === "6543") {
      url.searchParams.set("pgbouncer", "true");
      url.searchParams.set("connection_limit", "1");
      url.searchParams.set("pool_timeout", "20");
    }

    return url.toString();
  } catch (error) {
    console.warn("DATABASE_URL tidak dapat dinormalisasi untuk runtime:", error?.message);
    return raw;
  }
}

const databaseUrlRuntime = buatDatabaseUrlRuntime();
const konfigurasiPrisma = databaseUrlRuntime
  ? { datasources: { db: { url: databaseUrlRuntime } } }
  : undefined;

const prisma =
  globalForPrisma.__zamanTeknindoPrisma || new PrismaClient(konfigurasiPrisma);

if (!globalForPrisma.__zamanTeknindoPrisma) {
  globalForPrisma.__zamanTeknindoPrisma = prisma;
}

// Retry hanya untuk operasi BACA yang gagal karena koneksi sementara.
// Jangan retry create/update/delete agar tidak ada risiko operasi tulis
// dieksekusi dua kali ketika jaringan putus di tengah request.
const AKSI_BACA = new Set([
  "findUnique",
  "findFirst",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

if (!globalForPrisma.__zamanTeknindoPrismaMiddlewareTerpasang) {
  prisma.$use(async (params, next) => {
    if (!AKSI_BACA.has(params.action)) return next(params);

    const DELAY_RETRY_MS = [250, 800];
    let errorTerakhir;

    for (let percobaan = 0; percobaan <= DELAY_RETRY_MS.length; percobaan += 1) {
      try {
        return await next(params);
      } catch (error) {
        errorTerakhir = error;
        const kode = error?.code;
        const bolehRetry = kode === "P1001" || kode === "P2024";

        if (!bolehRetry || percobaan >= DELAY_RETRY_MS.length) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, DELAY_RETRY_MS[percobaan]));
      }
    }

    throw errorTerakhir;
  });

  globalForPrisma.__zamanTeknindoPrismaMiddlewareTerpasang = true;
}

module.exports = prisma;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const a = await prisma.absensi.findMany({orderBy:{dibuatPada:'desc'},take:3});
  console.log('Absen Terakhir:', JSON.stringify(a.map(x => ({ lat: x.latitudeMasuk, lng: x.longitudeMasuk, alamat: x.alamatMasuk })), null, 2));
  const k = await prisma.kantor.findFirst();
  console.log('Kantor:', JSON.stringify(k, null, 2));
}

main().finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const absensi = await prisma.absensi.findMany({
    where: {
      OR: [
        { alamatMasuk: null },
        { latitudeMasuk: 0 },
        { latitudeMasuk: null }
      ]
    },
    include: {
      pengguna: {
        include: {
          kantor: true
        }
      }
    }
  });

  let updated = 0;
  for (const a of absensi) {
    const kantor = a.pengguna?.kantor;
    if (kantor) {
      const finalLatitude = a.latitudeMasuk === null || a.latitudeMasuk === 0 ? kantor.latitude : a.latitudeMasuk;
      const finalLongitude = a.longitudeMasuk === null || a.longitudeMasuk === 0 ? kantor.longitude : a.longitudeMasuk;
      const finalAlamat = a.alamatMasuk || `Absen via Kiosk: ${kantor.namaKantor}${kantor.alamat ? ` - ${kantor.alamat}` : ''}`;
      
      const finalLatitudePulang = a.jamPulang && (a.latitudePulang === null || a.latitudePulang === 0) ? kantor.latitude : a.latitudePulang;
      const finalLongitudePulang = a.jamPulang && (a.longitudePulang === null || a.longitudePulang === 0) ? kantor.longitude : a.longitudePulang;
      const finalAlamatPulang = a.jamPulang && !a.alamatPulang ? `Absen via Kiosk: ${kantor.namaKantor}${kantor.alamat ? ` - ${kantor.alamat}` : ''}` : a.alamatPulang;
      
      await prisma.absensi.update({
        where: { id: a.id },
        data: {
          latitudeMasuk: finalLatitude,
          longitudeMasuk: finalLongitude,
          alamatMasuk: finalAlamat,
          latitudePulang: finalLatitudePulang,
          longitudePulang: finalLongitudePulang,
          alamatPulang: finalAlamatPulang
        }
      });
      updated++;
    }
  }
  console.log('Updated ' + updated + ' records');
}

main().catch(console.error).finally(() => prisma.$disconnect());

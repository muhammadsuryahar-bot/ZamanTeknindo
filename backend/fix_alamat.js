const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function ambilDetailNominatim(lat, lon) {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
    headers: { 'User-Agent': 'ZamanTeknindoBackend/1.0' }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const a = data.address || {};
  const namaJalan = a.road || a.pedestrian || a.residential || a.living_street || a.footway || a.cycleway || a.path || a.service || null;
  const jalan = [namaJalan, a.house_number].filter(Boolean).join(" No. ") || null;
  const kotaKecamatan = [a.village || a.suburb, a.city || a.town || a.county].filter(Boolean).join(", ") || null;
  const bagian = [jalan, kotaKecamatan, a.state].filter(Boolean);
  return bagian.join(", ");
}

async function fixAddresses() {
  const absensis = await prisma.absensi.findMany();
  for (const absen of absensis) {
    let changed = false;
    let data = {};
    
    // Fix alamat masuk
    if (absen.alamatMasuk && /^\d+\.\d+/.test(absen.alamatMasuk) && absen.latitudeMasuk) {
      console.log(`Fixing Masuk ID ${absen.id}...`);
      const alamat = await ambilDetailNominatim(absen.latitudeMasuk, absen.longitudeMasuk);
      if (alamat) {
        const akurasi = absen.alamatMasuk.match(/\(akurasi.*\)/)?.[0] || "";
        data.alamatMasuk = `${alamat} ${akurasi}`.trim();
        changed = true;
      }
      await new Promise(r => setTimeout(r, 1000)); // sleep 1s
    }

    // Fix alamat pulang
    if (absen.alamatPulang && /^\d+\.\d+/.test(absen.alamatPulang) && absen.latitudePulang) {
      console.log(`Fixing Pulang ID ${absen.id}...`);
      const alamat = await ambilDetailNominatim(absen.latitudePulang, absen.longitudePulang);
      if (alamat) {
        const akurasi = absen.alamatPulang.match(/\(akurasi.*\)/)?.[0] || "";
        data.alamatPulang = `${alamat} ${akurasi}`.trim();
        changed = true;
      }
      await new Promise(r => setTimeout(r, 1000)); // sleep 1s
    }

    if (changed) {
      await prisma.absensi.update({ where: { id: absen.id }, data });
      console.log(`Updated ID ${absen.id}`);
    }
  }
  console.log("Selesai!");
}

fixAddresses().catch(console.error).finally(() => prisma.$disconnect());

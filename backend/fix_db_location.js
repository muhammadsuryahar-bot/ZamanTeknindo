const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function geocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'id' } });
    const data = await res.json();
    const a = data.address || {};
    const jalan = a.road || a.pedestrian || a.residential || a.living_street || a.footway || null;
    const kecamatan = a.suburb || a.city_district || a.district || a.village || null;
    const kota = a.city || a.town || a.municipality || a.county || null;
    const provinsi = a.state || a.province || null;
    const bagian = [jalan, kecamatan, kota, provinsi].filter(Boolean);
    if (bagian.length) return bagian.join(", ");
  } catch (e) {
    console.log("Nominatim fail", e.message);
  }
  
  try {
    const res2 = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`);
    const data = await res2.json();
    const bagian = [
      data.locality,
      data.city && data.city !== data.locality ? data.city : null,
      data.principalSubdivision,
    ].filter(Boolean);
    if (bagian.length) return bagian.join(", ");
  } catch(e) {}
  
  return null;
}

function extractAkurasi(str) {
  const m = String(str).match(/\(akurasi\s*±([^\)]+)\)/i);
  return m ? m[0] : "";
}

async function main() {
  const absensi = await prisma.absensi.findMany({
    orderBy: { dibuatPada: 'desc' },
    take: 100
  });

  let count = 0;
  for (const a of absensi) {
    if (a.alamatMasuk && /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+/.test(a.alamatMasuk)) {
      console.log(`Fixing Masuk for ID ${a.id}`);
      const alamat = await geocode(a.latitudeMasuk, a.longitudeMasuk);
      if (alamat) {
        const ak = extractAkurasi(a.alamatMasuk);
        await prisma.absensi.update({
          where: { id: a.id },
          data: { alamatMasuk: `${alamat} ${ak}`.trim() }
        });
        console.log(`Updated Masuk ID ${a.id} -> ${alamat}`);
        count++;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    if (a.alamatPulang && /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+/.test(a.alamatPulang)) {
      console.log(`Fixing Pulang for ID ${a.id}`);
      const alamat = await geocode(a.latitudePulang, a.longitudePulang);
      if (alamat) {
         const ak = extractAkurasi(a.alamatPulang);
         await prisma.absensi.update({
          where: { id: a.id },
          data: { alamatPulang: `${alamat} ${ak}`.trim() }
        });
        console.log(`Updated Pulang ID ${a.id} -> ${alamat}`);
        count++;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  console.log(`Finished fixing ${count} records.`);
}

main().finally(() => prisma.$disconnect());

const prisma = require("../utils/prismaClient");

// Radius toleransi untuk mengenali sebuah absensi sebagai berada di area kantor.
// 10 km dipakai sebagai batas aman untuk GPS HP yang bisa meleset, tetapi kantor
// yang terlalu jauh tidak akan pernah dianggap sebagai kantor absensi.
const RADIUS_MAKSIMAL_KANTOR_METER = 10_000;

function koordinatValid(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function jarakHaversineMeter(lat1, lng1, lat2, lng2) {
  const toRad = (nilai) => (nilai * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function deteksiKantorDariKoordinat(latitude, longitude) {
  if (!koordinatValid(latitude, longitude)) return null;

  const kantor = await prisma.kantor.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      namaKantor: true,
      alamat: true,
      latitude: true,
      longitude: true,
    },
  });

  let terdekat = null;

  for (const item of kantor) {
    const jarakMeter = jarakHaversineMeter(
      Number(latitude),
      Number(longitude),
      Number(item.latitude),
      Number(item.longitude),
    );

    if (!terdekat || jarakMeter < terdekat.jarakMeter) {
      terdekat = { ...item, jarakMeter: Math.round(jarakMeter) };
    }
  }

  if (!terdekat || terdekat.jarakMeter > RADIUS_MAKSIMAL_KANTOR_METER) {
    return null;
  }

  return terdekat;
}

module.exports = {
  deteksiKantorDariKoordinat,
  RADIUS_MAKSIMAL_KANTOR_METER,
};

const prisma = require("../utils/prismaClient");
const { tanggalHariIniWIB } = require("../utils/waktuIndonesia");
const { buatSignedUrlFotoBatch } = require("../utils/supabaseStorage");

// Radius hanya dipakai untuk memberi status informasi kepada Admin.
// Absensi tetap diterima walaupun berada di luar radius.
const RADIUS_HOMEBASE_METER = 1500;

function hitungJarakMeter(latitude, longitude, homebaseLatitude, homebaseLongitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hLat = Number(homebaseLatitude);
  const hLng = Number(homebaseLongitude);

  if (![lat, lng, hLat, hLng].every(Number.isFinite)) return null;

  const toRad = (nilai) => (nilai * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(hLat - lat);
  const dLng = toRad(hLng - lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat)) *
      Math.cos(toRad(hLat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buatInfoHomebase(latitude, longitude, kantor) {
  if (!kantor) {
    return {
      id: null,
      namaKantor: null,
      alamatKantor: null,
      jarakMeter: null,
      dalamRadius: null,
      status: "Homebase belum ditentukan",
    };
  }

  const jarakMeter = hitungJarakMeter(
    latitude,
    longitude,
    kantor.latitude,
    kantor.longitude,
  );

  if (jarakMeter == null) {
    return {
      id: kantor.id,
      namaKantor: kantor.namaKantor,
      alamatKantor: kantor.alamat,
      jarakMeter: null,
      dalamRadius: null,
      status: "Jarak homebase tidak dapat dihitung",
    };
  }

  const jarakBulat = Math.round(jarakMeter);
  const dalamRadius = jarakMeter <= RADIUS_HOMEBASE_METER;

  return {
    id: kantor.id,
    namaKantor: kantor.namaKantor,
    alamatKantor: kantor.alamat,
    jarakMeter: jarakBulat,
    dalamRadius,
    status: dalamRadius
      ? "Dalam radius homebase"
      : "Di luar radius homebase",
  };
}

function tambahInfoLokasi(item, petaUrlFoto) {
  const fotoMasukUrl = item.fotoMasuk
    ? item.fotoMasuk.startsWith("/uploads/")
      ? item.fotoMasuk
      : petaUrlFoto.get(item.fotoMasuk) || null
    : null;

  const fotoPulangUrl = item.fotoPulang
    ? item.fotoPulang.startsWith("/uploads/")
      ? item.fotoPulang
      : petaUrlFoto.get(item.fotoPulang) || null
    : null;

  const homebaseMasuk = buatInfoHomebase(
    item.latitudeMasuk,
    item.longitudeMasuk,
    item.pengguna?.kantor || null,
  );
  const homebasePulang = buatInfoHomebase(
    item.latitudePulang,
    item.longitudePulang,
    item.pengguna?.kantor || null,
  );

  const alamatAsliMasuk = item.alamatMasuk || null;
  const alamatAsliPulang = item.alamatPulang || null;

  return {
    ...item,
    fotoMasukUrl,
    fotoPulangUrl,
    // Tetap pertahankan field kantorAbsensi untuk kompatibilitas frontend lama,
    // tetapi sekarang nilainya selalu Homebase karyawan, bukan kantor terdekat.
    kantorAbsensi: homebaseMasuk,
    kantorPulangAbsensi: homebasePulang,
    homebaseMasuk,
    homebasePulang,
    jarakHomebaseMasukMeter: homebaseMasuk.jarakMeter,
    jarakHomebasePulangMeter: homebasePulang.jarakMeter,
    statusHomebaseMasuk: homebaseMasuk.status,
    statusHomebasePulang: homebasePulang.status,
    alamatMasuk: alamatAsliMasuk
      ? homebaseMasuk.namaKantor
        ? `${homebaseMasuk.namaKantor} · ${alamatAsliMasuk}`
        : alamatAsliMasuk
      : homebaseMasuk.namaKantor || "Lokasi GPS belum tersedia",
    alamatPulang: alamatAsliPulang
      ? homebasePulang.namaKantor
        ? `${homebasePulang.namaKantor} · ${alamatAsliPulang}`
        : alamatAsliPulang
      : homebasePulang.namaKantor || "Lokasi GPS belum tersedia",
  };
}

async function rekapHariIniFixed(req, res) {
  try {
    const tanggal = tanggalHariIniWIB();

    // Homebase diambil langsung dari kantor yang terpasang pada karyawan.
    // Tidak ada lagi pencarian kantor terdekat dari koordinat absensi.
    const [data, karyawanAktif] = await Promise.all([
      prisma.absensi.findMany({
        where: { tanggal },
        include: {
          pengguna: {
            select: {
              id: true,
              nama: true,
              jabatan: true,
              divisi: true,
              kantor: {
                select: {
                  id: true,
                  namaKantor: true,
                  alamat: true,
                  latitude: true,
                  longitude: true,
                },
              },
            },
          },
        },
        orderBy: { jamMasuk: "asc" },
      }),
      prisma.pengguna.findMany({
        where: { peran: "karyawan", statusAkun: "aktif" },
        select: {
          id: true,
          nama: true,
          jabatan: true,
          divisi: true,
          kantor: {
            select: { id: true, namaKantor: true },
          },
        },
        orderBy: { nama: "asc" },
      }),
    ]);

    const semuaPathFoto = [];
    for (const item of data) {
      if (item.fotoMasuk && !item.fotoMasuk.startsWith("/uploads/")) {
        semuaPathFoto.push(item.fotoMasuk);
      }
      if (item.fotoPulang && !item.fotoPulang.startsWith("/uploads/")) {
        semuaPathFoto.push(item.fotoPulang);
      }
    }

    // Kantor sudah ikut dari relasi karyawan sehingga tidak perlu query
    // seluruh kantor untuk menentukan lokasi absensi setiap baris.
    const petaUrlFoto = await buatSignedUrlFotoBatch(semuaPathFoto);

    const dataDenganKantor = data.map((item) =>
      tambahInfoLokasi(item, petaUrlFoto),
    );

    const sudahAbsen = new Set(
      data
        .map((item) => item.pengguna?.id)
        .filter((id) => id != null),
    );
    const belumAbsen = karyawanAktif.filter(
      (karyawan) => !sudahAbsen.has(karyawan.id),
    );

    return res.json({
      data: dataDenganKantor,
      belumAbsen,
      jumlahKaryawanAktif: karyawanAktif.length,
    });
  } catch (error) {
    console.error("Gagal mengambil rekap absensi:", error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server." });
  }
}

module.exports = { rekapHariIniFixed };

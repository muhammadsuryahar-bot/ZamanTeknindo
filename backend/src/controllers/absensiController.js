const prisma = require("../utils/prismaClient");
const {
  tanggalHariIniWIB,
  jamSekarangWIB,
} = require("../utils/waktuIndonesia");

function jamKeDesimal(jamString) {
  const [jam, menit] = jamString.split(":").map(Number);
  return jam + (menit || 0) / 60;
}

async function ambilJamBatasMasuk() {
  const pengaturan = await prisma.pengaturanPotongan.findUnique({
    where: { id: 1 },
  });
  const jamStandar = pengaturan?.jamMasukStandar || "08:00:00";
  return jamKeDesimal(jamStandar);
}

function tanggalHariIni() {
  return tanggalHariIniWIB();
}

// Kalau ada "waktuAsli" dari klien (dikirim saat karyawan menekan tombol,
// dipakai terutama buat absen yang sempat nyangkut di antrian offline dan
// baru berhasil terkirim belakangan), pakai jam ITU sebagai jam absen --
// BUKAN jam server terima request. Tanpa ini, karyawan yang sudah benar
// absen tepat waktu tapi sinyalnya jelek bisa salah tercatat "Telat" cuma
// karena requestnya baru sampai ke server belakangan.
//
// Tapi tetap dibatasi wajar (maksimal mundur 12 jam dari sekarang, dan
// tidak boleh di masa depan) -- supaya field ini tidak disalahgunakan buat
// selalu ngaku "tepat waktu" dengan kirim jam sembarangan yang jauh di masa
// lalu. 12 jam cukup longgar buat kasus sinyal jelek di lapangan yang wajar,
// tapi tetap membatasi potensi kecurangan.
function tentukanJamAbsen(waktuAsliDariKlien) {
  const sekarang = new Date();
  if (!waktuAsliDariKlien) return sekarang;

  const waktuKlien = new Date(waktuAsliDariKlien);
  if (isNaN(waktuKlien.getTime())) return sekarang; // format tidak valid, abaikan

  const batasMundur = new Date(sekarang.getTime() - 12 * 60 * 60 * 1000);
  if (waktuKlien > sekarang || waktuKlien < batasMundur) return sekarang; // di luar rentang wajar, abaikan

  return waktuKlien;
}

async function absenMasuk(req, res) {
  try {
    const penggunaId = req.user.id;
    const { latitude, longitude, alamat, waktuAsli } = req.body;

    if (!req.file)
      return res.status(400).json({ pesan: "Foto absen wajib diunggah." });

    const tanggal = tanggalHariIni();
    const sudahAbsen = await prisma.absensi.findUnique({
      where: { penggunaId_tanggal: { penggunaId, tanggal } },
    });

    if (sudahAbsen && sudahAbsen.jamMasuk) {
      return res
        .status(400)
        .json({ pesan: "Anda sudah melakukan absen masuk hari ini." });
    }

    const jamBatasMasuk = await ambilJamBatasMasuk();
    const sekarang = tentukanJamAbsen(waktuAsli);
    const jamSekarang = jamSekarangWIB(sekarang);
    const statusOtomatis =
      jamSekarang <= jamBatasMasuk ? "tepat_waktu" : "telat";
    const fotoPath = req.file.filename;

    const data = {
      jamMasuk: sekarang,
      fotoMasuk: fotoPath,
      latitudeMasuk: latitude ? parseFloat(latitude) : null,
      longitudeMasuk: longitude ? parseFloat(longitude) : null,
      alamatMasuk: alamat || null,
      statusOtomatis,
      statusFinal: statusOtomatis,
    };

    const absensi = sudahAbsen
      ? await prisma.absensi.update({ where: { id: sudahAbsen.id }, data })
      : await prisma.absensi.create({ data: { penggunaId, tanggal, ...data } });

    return res.status(201).json({
      pesan: `Absen masuk berhasil! Status: ${statusOtomatis === "tepat_waktu" ? "Tepat Waktu" : "Telat"}.`,
      data: absensi,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server. Silakan coba lagi.",
    });
  }
}

async function absenPulang(req, res) {
  try {
    const penggunaId = req.user.id;
    const { latitude, longitude, alamat, waktuAsli } = req.body;
    if (!req.file)
      return res.status(400).json({ pesan: "Foto absen wajib diunggah." });

    const tanggal = tanggalHariIni();
    const absensiHariIni = await prisma.absensi.findUnique({
      where: { penggunaId_tanggal: { penggunaId, tanggal } },
    });

    if (!absensiHariIni || !absensiHariIni.jamMasuk) {
      return res
        .status(400)
        .json({ pesan: "Anda belum melakukan absen masuk hari ini." });
    }
    if (absensiHariIni.jamPulang) {
      return res
        .status(400)
        .json({ pesan: "Anda sudah melakukan absen pulang hari ini." });
    }

    const absensi = await prisma.absensi.update({
      where: { id: absensiHariIni.id },
      data: {
        jamPulang: tentukanJamAbsen(waktuAsli),
        fotoPulang: req.file.filename,
        latitudePulang: latitude ? parseFloat(latitude) : null,
        longitudePulang: longitude ? parseFloat(longitude) : null,
        alamatPulang: alamat || null,
      },
    });

    return res
      .status(200)
      .json({ pesan: "Absen pulang berhasil! Terima kasih.", data: absensi });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server. Silakan coba lagi.",
    });
  }
}

async function riwayatSaya(req, res) {
  try {
    const riwayat = await prisma.absensi.findMany({
      where: { penggunaId: req.user.id },
      orderBy: { tanggal: "desc" },
      take: 31,
    });
    return res.json({ data: riwayat });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server. Silakan coba lagi.",
    });
  }
}

async function statusHariIni(req, res) {
  try {
    const absensi = await prisma.absensi.findUnique({
      where: {
        penggunaId_tanggal: {
          penggunaId: req.user.id,
          tanggal: tanggalHariIni(),
        },
      },
    });

    let tahap = "belum_masuk";
    if (absensi?.jamMasuk && !absensi?.jamPulang) tahap = "sudah_masuk";
    if (absensi?.jamMasuk && absensi?.jamPulang) tahap = "selesai";

    return res.json({ tahap, data: absensi || null });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server. Silakan coba lagi.",
    });
  }
}

module.exports = { absenMasuk, absenPulang, riwayatSaya, statusHariIni };

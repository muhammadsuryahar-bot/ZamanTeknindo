const prisma = require("../utils/prismaClient");

function parseKoordinat(value, nama, min, max) {
  if (value === "" || value == null) return null;
  const angka = Number(String(value).replace(",", "."));
  if (!Number.isFinite(angka) || angka < min || angka > max) {
    const error = new Error(`${nama} harus berupa angka antara ${min} dan ${max}.`);
    error.statusCode = 400;
    throw error;
  }
  return angka;
}

function parseId(value) {
  const id = Number.parseInt(String(value), 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function daftarKantorFixed(req, res) {
  try {
    const data = await prisma.kantor.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { pengguna: true } } },
    });
    return res.json({ data });
  } catch (error) {
    console.error("Gagal mengambil daftar kantor:", error);
    return res.status(500).json({ pesan: "Gagal memuat data kantor." });
  }
}

async function tambahKantorFixed(req, res) {
  try {
    const namaKantor = String(req.body?.namaKantor || "").trim();
    const alamat = String(req.body?.alamat || "").trim();
    if (!namaKantor) return res.status(400).json({ pesan: "Nama kantor wajib diisi." });

    const latitude = parseKoordinat(req.body?.latitude, "Latitude", -90, 90);
    const longitude = parseKoordinat(req.body?.longitude, "Longitude", -180, 180);

    if ((latitude == null) !== (longitude == null)) {
      return res.status(400).json({ pesan: "Latitude dan longitude harus diisi berpasangan." });
    }

    const kantor = await prisma.kantor.create({
      data: {
        namaKantor,
        alamat: alamat || null,
        latitude,
        longitude,
      },
      include: { _count: { select: { pengguna: true } } },
    });

    return res.status(201).json({ pesan: `Kantor "${kantor.namaKantor}" berhasil ditambahkan.`, data: kantor });
  } catch (error) {
    console.error("Gagal menambah kantor:", error);
    const status = error?.statusCode || 500;
    return res.status(status).json({ pesan: error?.message || "Gagal menyimpan kantor." });
  }
}

async function ubahKantorFixed(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ pesan: "ID kantor tidak valid." });

    const namaKantor = String(req.body?.namaKantor || "").trim();
    const alamat = String(req.body?.alamat || "").trim();
    if (!namaKantor) return res.status(400).json({ pesan: "Nama kantor wajib diisi." });

    const latitude = parseKoordinat(req.body?.latitude, "Latitude", -90, 90);
    const longitude = parseKoordinat(req.body?.longitude, "Longitude", -180, 180);
    if ((latitude == null) !== (longitude == null)) {
      return res.status(400).json({ pesan: "Latitude dan longitude harus diisi berpasangan." });
    }

    const ada = await prisma.kantor.findUnique({ where: { id }, select: { id: true } });
    if (!ada) return res.status(404).json({ pesan: "Kantor yang akan diedit tidak ditemukan." });

    const kantor = await prisma.kantor.update({
      where: { id },
      data: {
        namaKantor,
        alamat: alamat || null,
        latitude,
        longitude,
      },
      include: { _count: { select: { pengguna: true } } },
    });

    return res.json({ pesan: `Kantor "${kantor.namaKantor}" berhasil diperbarui.`, data: kantor });
  } catch (error) {
    console.error("Gagal mengubah kantor:", error);
    const status = error?.code === "P2025" ? 404 : error?.statusCode || 500;
    return res.status(status).json({ pesan: error?.message || "Gagal menyimpan perubahan kantor." });
  }
}

module.exports = { daftarKantorFixed, tambahKantorFixed, ubahKantorFixed };

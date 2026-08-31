const ExcelJS = require("exceljs");
const prisma = require("../utils/prismaClient");

const MAX_ROWS = 500;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function parseMoney(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : null;
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function sanitizeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    email: normalizeEmail(row?.email),
    nama: String(row?.nama ?? "").trim(),
    gajiPokok: parseMoney(row?.gajiPokok),
  }));
}

async function templateGajiMassal(req, res) {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Gaji Pokok");

    sheet.columns = [
      { header: "Email", key: "email", width: 34 },
      { header: "Nama", key: "nama", width: 30 },
      { header: "Gaji Pokok", key: "gajiPokok", width: 18 },
    ];

    const karyawan = await prisma.pengguna.findMany({
      where: { peran: "karyawan", statusAkun: "aktif" },
      select: { nama: true, email: true, gaji: { select: { gajiPokok: true } } },
      orderBy: { nama: "asc" },
    });

    for (const item of karyawan) {
      sheet.addRow({
        email: item.email,
        nama: item.nama,
        gajiPokok: item.gaji?.gajiPokok != null ? Number(item.gaji.gajiPokok) : "",
      });
    }

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B7A4B" } };
    header.alignment = { vertical: "middle" };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    sheet.addRow([]);
    sheet.addRow(["PETUNJUK"]);
    sheet.addRow(["Email wajib diisi dan harus sama dengan email akun karyawan aktif."]);
    sheet.addRow(["Nama hanya untuk pengecekan Admin; sistem menyimpan berdasarkan email."]);
    sheet.addRow(["Gaji Pokok isi angka, misalnya 7500000. Jangan memakai rumus."]);

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="Template_Gaji_Pokok_PT_Zaman_Teknindo.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Gagal membuat template gaji massal:", error);
    return res.status(500).json({ pesan: "Gagal membuat template Excel." });
  }
}

async function previewGajiMassal(req, res) {
  try {
    if (!req.file) return res.status(400).json({ pesan: "File Excel wajib dipilih." });
    if (req.file.size > MAX_FILE_BYTES) return res.status(400).json({ pesan: "Ukuran file maksimal 2 MB." });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return res.status(400).json({ pesan: "Sheet Excel tidak ditemukan." });

    const headerMap = new Map();
    sheet.getRow(1).eachCell((cell, colNumber) => {
      const h = normalizeHeader(cell.value);
      if (h) headerMap.set(h, colNumber);
    });

    const emailCol = headerMap.get("email");
    const namaCol = headerMap.get("nama");
    const gajiCol = headerMap.get("gajipokok") || headerMap.get("gaji");

    if (!emailCol || !gajiCol) {
      return res.status(400).json({
        pesan: "Format Excel tidak sesuai. Kolom wajib: Email dan Gaji Pokok. Kolom Nama opsional.",
      });
    }

    const rawRows = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const email = normalizeEmail(row.getCell(emailCol).value);
      const nama = String(namaCol ? row.getCell(namaCol).value ?? "" : "").trim();
      const gajiPokok = parseMoney(row.getCell(gajiCol).value);
      if (email || nama || gajiPokok != null) rawRows.push({ email, nama, gajiPokok, nomorBaris: rowNumber });
    });

    if (rawRows.length === 0) return res.status(400).json({ pesan: "Excel tidak memiliki data karyawan." });
    if (rawRows.length > MAX_ROWS) return res.status(400).json({ pesan: `Maksimal ${MAX_ROWS} baris per import.` });

    const emails = [...new Set(rawRows.map((r) => r.email).filter(Boolean))];
    const users = await prisma.pengguna.findMany({
      where: { peran: "karyawan", statusAkun: "aktif", email: { in: emails } },
      select: { id: true, email: true, nama: true },
    });
    const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
    const seen = new Set();

    const rows = rawRows.map((r) => {
      const errorMessages = [];
      if (!r.email) errorMessages.push("Email kosong");
      if (seen.has(r.email)) errorMessages.push("Email duplikat di Excel");
      if (r.email) seen.add(r.email);
      const user = byEmail.get(r.email);
      if (r.email && !user) errorMessages.push("Email tidak ditemukan pada karyawan aktif");
      if (r.gajiPokok == null) errorMessages.push("Gaji pokok kosong/tidak valid");
      if (r.gajiPokok != null && (r.gajiPokok < 0 || r.gajiPokok > 999999999999)) errorMessages.push("Nominal gaji tidak valid");

      let pesan = "Siap";
      if (user && r.nama && r.nama.toLowerCase() !== user.nama.trim().toLowerCase()) {
        pesan = `Nama Excel berbeda dari akun: ${user.nama}. Email tetap digunakan sebagai identitas.`;
      }

      return {
        nomorBaris: r.nomorBaris,
        email: r.email,
        nama: user?.nama || r.nama,
        gajiPokok: r.gajiPokok == null ? "" : String(r.gajiPokok),
        status: errorMessages.length ? "error" : "siap",
        pesan: errorMessages.length ? errorMessages.join("; ") : pesan,
      };
    });

    const errorCount = rows.filter((r) => r.status === "error").length;
    return res.json({ total: rows.length, errorCount, rows });
  } catch (error) {
    console.error("Gagal preview gaji massal:", error);
    return res.status(400).json({ pesan: "File Excel tidak dapat dibaca. Pastikan menggunakan format .xlsx yang valid." });
  }
}

async function simpanGajiMassal(req, res) {
  try {
    const rows = sanitizeRows(req.body?.rows);
    if (!rows.length) return res.status(400).json({ pesan: "Tidak ada data gaji yang akan disimpan." });
    if (rows.length > MAX_ROWS) return res.status(400).json({ pesan: `Maksimal ${MAX_ROWS} data per penyimpanan.` });

    const emails = rows.map((r) => r.email);
    if (emails.some((email) => !email)) return res.status(400).json({ pesan: "Semua baris wajib memiliki email." });
    if (emails.length !== new Set(emails).size) return res.status(400).json({ pesan: "Ada email duplikat. Perbaiki Excel lalu impor ulang." });
    if (rows.some((r) => r.gajiPokok == null || r.gajiPokok < 0 || !Number.isSafeInteger(r.gajiPokok))) {
      return res.status(400).json({ pesan: "Ada nominal gaji pokok yang tidak valid." });
    }

    const users = await prisma.pengguna.findMany({
      where: { peran: "karyawan", statusAkun: "aktif", email: { in: emails } },
      select: { id: true, email: true },
    });
    const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
    const missing = emails.filter((email) => !byEmail.has(email));
    if (missing.length) return res.status(400).json({ pesan: `${missing.length} email tidak ditemukan pada karyawan aktif. Tidak ada data yang disimpan.` });

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        await tx.gajiKaryawan.upsert({
          where: { penggunaId: byEmail.get(row.email) },
          update: { gajiPokok: row.gajiPokok },
          create: { penggunaId: byEmail.get(row.email), gajiPokok: row.gajiPokok },
        });
      }
    });

    return res.json({ pesan: `${rows.length} gaji pokok berhasil disimpan.` });
  } catch (error) {
    console.error("Gagal simpan gaji massal:", error);
    return res.status(500).json({ pesan: "Gagal menyimpan gaji pokok massal." });
  }
}

module.exports = { templateGajiMassal, previewGajiMassal, simpanGajiMassal };

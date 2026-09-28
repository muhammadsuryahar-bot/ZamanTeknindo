const prisma = require("../utils/prismaClient");
const ExcelJS = require("exceljs");

const WARNA = {
  header: "FF1F4E79",
  garis: "FFD9E0E7",
  teks: "FF243247",
  putih: "FFFFFFFF",
};

function gayaHeader(row, jumlahKolom) {
  for (let kolom = 1; kolom <= jumlahKolom; kolom += 1) {
    const cell = row.getCell(kolom);
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: WARNA.putih } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WARNA.header } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: WARNA.garis } },
      left: { style: "thin", color: { argb: WARNA.garis } },
      bottom: { style: "thin", color: { argb: WARNA.garis } },
      right: { style: "thin", color: { argb: WARNA.garis } },
    };
  }
  row.height = 28;
}

function gayaData(cell, { center = false, bold = false } = {}) {
  cell.font = { name: "Aptos", size: 10, bold, color: { argb: WARNA.teks } };
  cell.alignment = {
    horizontal: center ? "center" : "left",
    vertical: "middle",
    wrapText: true,
  };
  cell.border = {
    top: { style: "thin", color: { argb: WARNA.garis } },
    left: { style: "thin", color: { argb: WARNA.garis } },
    bottom: { style: "thin", color: { argb: WARNA.garis } },
    right: { style: "thin", color: { argb: WARNA.garis } },
  };
}


async function daftarKaryawanFixed(req, res) {
  try {
    const data = await prisma.pengguna.findMany({
      where: {
        peran: "karyawan",
        statusAkun: { not: "menunggu_konfirmasi" },
      },
      select: {
        id: true,
        nama: true,
        email: true,
        jabatan: true,
        divisi: true,
        kantorId: true,
        statusAkun: true,
        kantor: {
          select: {
            id: true,
            namaKantor: true,
          },
        },
      },
      orderBy: { nama: "asc" },
    });

    return res.json({ data });
  } catch (error) {
    console.error("Gagal mengambil daftar karyawan:", error);
    return res.status(500).json({ pesan: "Gagal memuat daftar karyawan." });
  }
}


async function exportDataKaryawan(req, res) {
  try {
    const data = await prisma.pengguna.findMany({
      where: {
        peran: "karyawan",
        statusAkun: { not: "menunggu_konfirmasi" },
      },
      select: {
        id: true,
        nama: true,
        email: true,
        jabatan: true,
        divisi: true,
        statusAkun: true,
        dibuatPada: true,
        kantor: { select: { namaKantor: true } },
      },
      orderBy: { nama: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Zaman Teknindo";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Data Karyawan", {
      views: [{ state: "frozen", ySplit: 4 }],
    });

    sheet.mergeCells("A1:H1");
    sheet.getCell("A1").value = "REKAP DATA KARYAWAN";
    sheet.getCell("A1").font = {
      name: "Aptos", size: 15, bold: true, color: { argb: WARNA.header },
    };
    sheet.getCell("A1").alignment = { horizontal: "left", vertical: "middle" };
    sheet.getRow(1).height = 24;

    sheet.mergeCells("A2:H2");
    sheet.getCell("A2").value =
      "Data kepegawaian operasional — tidak termasuk informasi gaji.";
    sheet.getCell("A2").font = {
      name: "Aptos", size: 10, italic: true, color: { argb: WARNA.teks },
    };

    sheet.mergeCells("A3:H3");
    sheet.getCell("A3").value = "Total karyawan: " + data.length;
    sheet.getCell("A3").font = {
      name: "Aptos", size: 10, bold: true, color: { argb: WARNA.teks },
    };

    const headers = [
      "No", "Nama", "Email", "Jabatan", "Divisi", "Kantor",
      "Status Akun", "Tanggal Daftar",
    ];
    const headerRow = sheet.getRow(4);
    headers.forEach((header, index) => {
      headerRow.getCell(index + 1).value = header;
    });
    gayaHeader(headerRow, headers.length);

    data.forEach((item, index) => {
      const row = sheet.addRow([
        index + 1,
        item.nama || "-",
        item.email || "-",
        item.jabatan || "-",
        item.divisi || "-",
        item.kantor?.namaKantor || "Belum ditentukan",
        item.statusAkun === "aktif" ? "Aktif" : "Nonaktif",
        item.dibuatPada
          ? new Date(item.dibuatPada).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })
          : "-",
      ]);
      row.eachCell((cell, columnNumber) => {
        gayaData(cell, {
          center: columnNumber === 1,
          bold: columnNumber === 2,
        });
      });
      row.height = 22;
    });

    sheet.columns = [
      { width: 6 }, { width: 28 }, { width: 34 }, { width: 24 },
      { width: 20 }, { width: 24 }, { width: 16 }, { width: 16 },
    ];

    sheet.autoFilter = { from: "A4", to: "H" + Math.max(4, data.length + 4) };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Rekap_Data_Karyawan.xlsx"',
    );
    res.setHeader("Cache-Control", "no-store, private");

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Gagal export data karyawan:", error);
    return res.status(500).json({ pesan: "Gagal membuat rekap data karyawan." });
  }
}

module.exports = { daftarKaryawanFixed, exportDataKaryawan };

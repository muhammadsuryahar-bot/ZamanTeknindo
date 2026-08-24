const ExcelJS = require("exceljs");

const prisma = require("../utils/prismaClient");

const {
  tahunBulanSekarangWIB,
  bagianWaktuWIB,
} = require("../utils/waktuIndonesia");
const { ambilSetHariLibur } = require("../utils/hariLibur");

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function formatRupiah(angka) {
  return `Rp ${Number(angka).toLocaleString("id-ID")}`;
}

function tanggalUTC(tahun, bulan, tanggal) {
  const b = String(bulan).padStart(2, "0");
  const t = String(tanggal).padStart(2, "0");

  return new Date(`${tahun}-${b}-${t}T00:00:00.000Z`);
}

function daftarHariKerja(tahun, bulan) {
  const hariDalamBulan = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();

  const daftar = [];

  for (let tanggal = 1; tanggal <= hariDalamBulan; tanggal++) {
    const d = tanggalUTC(tahun, bulan, tanggal);
    const hari = d.getUTCDay();

    // 0 = Minggu
    // 6 = Sabtu
    if (hari !== 0 && hari !== 6) {
      daftar.push(d);
    }
  }

  return daftar;
}

function formatTanggal(date) {
  if (!date) return "-";

  const wib = bagianWaktuWIB(date);

  return `${String(wib.hari).padStart(2, "0")}-${String(wib.bulan).padStart(
    2,
    "0",
  )}-${wib.tahun}`;
}

function formatJam(date) {
  if (!date) return "-";

  const wib = bagianWaktuWIB(date);

  return `${String(wib.jam).padStart(2, "0")}:${String(wib.menit).padStart(
    2,
    "0",
  )}:${String(wib.detik).padStart(2, "0")}`;
}

function hitungMenitTerlambat(jamMasuk, jamStandar = "08:00:00") {
  if (!jamMasuk) return 0;

  const [jam, menit, detik = 0] = String(jamStandar).split(":").map(Number);

  const standarMenit = jam * 60 + menit + Math.floor(detik / 60);

  const wib = bagianWaktuWIB(jamMasuk);

  const masukMenit = wib.jam * 60 + wib.menit;

  return Math.max(masukMenit - standarMenit, 0);
}

function formatKeterlambatan(menit) {
  if (!menit || menit <= 0) {
    return "-";
  }

  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;

  if (jam > 0) {
    return `${jam} jam ${sisaMenit} menit`;
  }

  return `${sisaMenit} menit`;
}

function statusTampilan(status) {
  switch (status) {
    case "tepat_waktu":
      return "Tepat Waktu";

    case "telat":
      return "Telat";

    case "alpha":
      return "Alpha";

    case "izin":
      return "Izin";

    case "sakit":
      return "Sakit";

    case "cuti":
      return "Cuti";

    case "urgent":
      return "Urgent";

    default:
      return status || "-";
  }
}

function buatStyleHeader(row) {
  row.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E79" },
  };

  row.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };

  row.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  row.height = 28;
}

function beriBorder(cell) {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}

// ============================================================
// ADMIN — Unduh laporan gaji bulanan sebagai file Excel
//
// GET /api/admin/gaji/export?tahun=2026&bulan=8
//
// Output:
// Sheet 1 = Rekap Gaji
// Sheet 2 = Detail Absensi
// ============================================================

async function exportLaporanExcel(req, res) {
  try {
    // ========================================================
    // WAKTU SEKARANG WIB
    // ========================================================

    const sekarangWIB = tahunBulanSekarangWIB();

    const waktuSekarangWIB = bagianWaktuWIB(new Date());

    const tahun = Number(req.query.tahun) || sekarangWIB.tahun;

    const bulan = Number(req.query.bulan) || sekarangWIB.bulan;

    // ========================================================
    // VALIDASI PARAMETER
    // ========================================================

    if (bulan < 1 || bulan > 12) {
      return res.status(400).json({
        pesan: "Bulan tidak valid.",
      });
    }

    if (tahun < 2000 || tahun > 2100) {
      return res.status(400).json({
        pesan: "Tahun tidak valid.",
      });
    }

    // ========================================================
    // 1. AMBIL LAPORAN GAJI
    // ========================================================

    const laporan = await prisma.laporanGaji.findMany({
      where: {
        tahun,
        bulan,
      },

      include: {
        pengguna: {
          select: {
            id: true,
            nama: true,
            jabatan: true,
            divisi: true,
          },
        },
      },

      orderBy: {
        pengguna: {
          nama: "asc",
        },
      },
    });

    if (laporan.length === 0) {
      return res.status(404).json({
        pesan: `Belum ada laporan gaji untuk ${
          NAMA_BULAN[bulan - 1]
        } ${tahun}. Hitung dulu lewat menu Gaji sebelum export.`,
      });
    }

    // ========================================================
    // 2. PENGATURAN POTONGAN
    // ========================================================

    const pengaturan = await prisma.pengaturanPotongan.findUnique({
      where: {
        id: 1,
      },
    });

    const jamMasukStandar = pengaturan?.jamMasukStandar || "08:00:00";

    const potonganTelat = Number(pengaturan?.potonganTelat || 0);

    const potonganAlpha = Number(pengaturan?.potonganAlpha || 0);

    // ========================================================
    // 3. RENTANG TANGGAL BULAN
    // ========================================================

    const awalBulan = tanggalUTC(tahun, bulan, 1);

    const akhirBulan = new Date(Date.UTC(tahun, bulan, 0, 23, 59, 59, 999));

    // ========================================================
    // 4. AMBIL DATA ABSENSI
    // ========================================================

    const penggunaIds = laporan.map((item) => item.penggunaId);

    const semuaAbsensi = await prisma.absensi.findMany({
      where: {
        penggunaId: {
          in: penggunaIds,
        },

        tanggal: {
          gte: awalBulan,
          lte: akhirBulan,
        },
      },

      include: {
        pengguna: {
          select: {
            nama: true,
            jabatan: true,
            divisi: true,
          },
        },
      },

      orderBy: [
        {
          tanggal: "asc",
        },
        {
          penggunaId: "asc",
        },
      ],
    });

    // ========================================================
    // 5. BUAT MAP ABSENSI
    // ========================================================

    const petaAbsensi = new Map();

    for (const absen of semuaAbsensi) {
      const tanggalKey = absen.tanggal.toISOString().slice(0, 10);

      petaAbsensi.set(`${absen.penggunaId}_${tanggalKey}`, absen);
    }

    // ========================================================
    // 6. BUAT WORKBOOK
    // ========================================================

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Sistem Absensi PT Zaman Teknindo";

    workbook.created = new Date();

    // ========================================================
    // SHEET 1 — REKAP GAJI
    // ========================================================

    const sheet = workbook.addWorksheet(
      `Gaji ${NAMA_BULAN[bulan - 1]} ${tahun}`,
    );

    sheet.mergeCells("A1:M1");

    sheet.getCell("A1").value = `Laporan Absensi & Gaji — ${
      NAMA_BULAN[bulan - 1]
    } ${tahun}`;

    sheet.getCell("A1").font = {
      bold: true,
      size: 14,
      color: {
        argb: "FF1F4E79",
      },
    };

    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.getRow(1).height = 30;

    const headerRow = sheet.getRow(3);

    headerRow.values = [
      "No",
      "Nama",
      "Jabatan",
      "Divisi",
      "Tepat Waktu",
      "Telat",
      "Alpha",
      "Izin",
      "Sakit",
      "Cuti",
      "Gaji Pokok",
      "Total Potongan",
      "Gaji Diterima",
    ];

    buatStyleHeader(headerRow);

    laporan.forEach((item, index) => {
      const baris = sheet.addRow([
        index + 1,
        item.pengguna.nama,
        item.pengguna.jabatan || "-",
        item.pengguna.divisi || "-",
        item.jumlahTepatWaktu,
        item.jumlahTelat,
        item.jumlahAlpha,
        item.jumlahIzin,
        item.jumlahSakit,
        item.jumlahCuti,
        Number(item.gajiPokok),
        Number(item.totalPotongan),
        Number(item.gajiDiterima),
      ]);

      baris.eachCell((cell, colNumber) => {
        beriBorder(cell);

        if (colNumber >= 11 && colNumber <= 13) {
          cell.numFmt = '"Rp" #,##0';
        }

        if (colNumber === 1 || (colNumber >= 5 && colNumber <= 10)) {
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
          };
        }
      });
    });

    // ========================================================
    // TOTAL
    // ========================================================

    const barisTotal = sheet.addRow([
      "",
      "",
      "",
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      "",
      laporan.reduce((sum, item) => sum + Number(item.gajiPokok), 0),
      laporan.reduce((sum, item) => sum + Number(item.totalPotongan), 0),
      laporan.reduce((sum, item) => sum + Number(item.gajiDiterima), 0),
    ]);

    barisTotal.font = {
      bold: true,
    };

    barisTotal.eachCell((cell, colNumber) => {
      beriBorder(cell);

      if (colNumber >= 11 && colNumber <= 13) {
        cell.numFmt = '"Rp" #,##0';
      }
    });

    sheet.columns = [
      { width: 5 },
      { width: 24 },
      { width: 16 },
      { width: 16 },
      { width: 12 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 16 },
      { width: 18 },
      { width: 18 },
    ];

    sheet.views = [
      {
        state: "frozen",
        ySplit: 3,
      },
    ];

    // ========================================================
    // SHEET 2 — DETAIL ABSENSI
    // ========================================================

    const detailSheet = workbook.addWorksheet("Detail Absensi");

    // Sekarang 12 kolom
    detailSheet.mergeCells("A1:L1");

    detailSheet.getCell("A1").value = `Detail Absensi — ${
      NAMA_BULAN[bulan - 1]
    } ${tahun}`;

    detailSheet.getCell("A1").font = {
      bold: true,
      size: 14,
      color: {
        argb: "FF1F4E79",
      },
    };

    detailSheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    detailSheet.getRow(1).height = 30;

    const detailHeader = detailSheet.getRow(3);

    detailHeader.values = [
      "No",
      "Tanggal",
      "Nama",
      "Jabatan",
      "Divisi",
      "Jam Masuk",
      "Jam Pulang",
      "Status Otomatis",
      "Status Final",
      "Keterlambatan",
      "Potongan",
      "Keterangan",
    ];

    buatStyleHeader(detailHeader);

    let nomorDetail = 1;

    const hariKerja = daftarHariKerja(tahun, bulan);
    const setHariLibur = await ambilSetHariLibur(tahun);
    // Sama seperti di hitungGajiController.js: hari libur nasional/cuti
    // bersama dikeluarkan dari daftar hari kerja, supaya laporan detail ini
    // tidak menampilkan SEMUA karyawan "Alpha" di hari yang memang libur.
    const hariKerjaSetelahLibur = hariKerja.filter(
      (d) => !setHariLibur.has(d.toISOString().slice(0, 10))
    );

    // ========================================================
    // TENTUKAN BATAS HARI UNTUK BULAN BERJALAN
    //
    // Kita gunakan HARI WIB, bukan Date() langsung,
    // supaya tanggal 14 tetap masuk saat sudah tanggal 14
    // di Indonesia.
    // ========================================================

    const bulanSedangBerjalan =
      tahun === sekarangWIB.tahun && bulan === sekarangWIB.bulan;

    const hariTerakhir = bulanSedangBerjalan
      ? waktuSekarangWIB.hari
      : hariKerja.length;

    const hariKerjaYangDitampilkan = bulanSedangBerjalan
      ? hariKerjaSetelahLibur.filter((tanggal) => tanggal.getUTCDate() <= hariTerakhir)
      : hariKerjaSetelahLibur;

    // ========================================================
    // LOOP KARYAWAN
    // ========================================================

    for (const item of laporan) {
      // ======================================================
      // LOOP TANGGAL
      // ======================================================

      for (const tanggal of hariKerjaYangDitampilkan) {
        const tanggalKey = tanggal.toISOString().slice(0, 10);

        const absen = petaAbsensi.get(`${item.penggunaId}_${tanggalKey}`);

        let statusOtomatis = "alpha";

        let statusFinal = "alpha";

        let jamMasuk = null;

        let jamPulang = null;

        let menitTerlambat = 0;

        let potongan = 0;

        let keterangan = "Tidak ada absensi";

        // ====================================================
        // JIKA ADA ABSENSI
        // ====================================================

        if (absen) {
          statusOtomatis = absen.statusOtomatis || "alpha";

          statusFinal = absen.statusFinal || statusOtomatis;

          jamMasuk = absen.jamMasuk;

          jamPulang = absen.jamPulang;

          menitTerlambat = hitungMenitTerlambat(
            absen.jamMasuk,
            jamMasukStandar,
          );

          // ================================================
          // POTONGAN BERDASARKAN STATUS FINAL
          // ================================================

          if (statusFinal === "telat") {
            potongan = potonganTelat;
          } else if (statusFinal === "alpha") {
            potongan = potonganAlpha;
          } else {
            potongan = 0;
          }

          // ================================================
          // KETERANGAN
          // ================================================

          if (absen.catatanAdmin) {
            keterangan = absen.catatanAdmin;
          } else if (statusFinal === "telat") {
            keterangan = `Terlambat ${formatKeterlambatan(menitTerlambat)}`;
          } else if (statusFinal === "tepat_waktu") {
            keterangan = "Masuk sesuai jadwal";
          } else if (statusFinal === "izin") {
            keterangan = "Izin";
          } else if (statusFinal === "sakit") {
            keterangan = "Sakit";
          } else if (statusFinal === "cuti") {
            keterangan = "Cuti";
          } else if (statusFinal === "urgent") {
            keterangan = "Urgent";
          } else {
            keterangan = "-";
          }
        }

        // ====================================================
        // JIKA TIDAK ADA ABSENSI
        // ====================================================
        else {
          statusOtomatis = "alpha";

          statusFinal = "alpha";

          jamMasuk = null;

          jamPulang = null;

          menitTerlambat = 0;

          potongan = potonganAlpha;

          keterangan = "Tidak ada absensi";
        }

        // ====================================================
        // TAMBAHKAN KE EXCEL
        // ====================================================

        const baris = detailSheet.addRow([
          nomorDetail++,
          formatTanggal(tanggal),
          item.pengguna.nama,
          item.pengguna.jabatan || "-",
          item.pengguna.divisi || "-",
          formatJam(jamMasuk),
          formatJam(jamPulang),
          statusTampilan(statusOtomatis),
          statusTampilan(statusFinal),
          formatKeterlambatan(menitTerlambat),
          potongan,
          keterangan,
        ]);

        baris.eachCell((cell, colNumber) => {
          beriBorder(cell);

          // No
          if (colNumber === 1) {
            cell.alignment = {
              horizontal: "center",
              vertical: "middle",
            };
          }

          // Tanggal
          if (colNumber === 2) {
            cell.alignment = {
              horizontal: "center",
              vertical: "middle",
            };
          }

          // Jam masuk & pulang
          if (colNumber === 6 || colNumber === 7) {
            cell.alignment = {
              horizontal: "center",
              vertical: "middle",
            };
          }

          // Status otomatis
          if (colNumber === 8) {
            cell.alignment = {
              horizontal: "center",
              vertical: "middle",
            };
          }

          // Status final
          if (colNumber === 9) {
            cell.alignment = {
              horizontal: "center",
              vertical: "middle",
            };
          }

          // Keterlambatan
          if (colNumber === 10) {
            cell.alignment = {
              horizontal: "center",
              vertical: "middle",
            };
          }

          // Potongan
          if (colNumber === 11) {
            cell.numFmt = '"Rp" #,##0';
          }
        });
      }
    }

    // ========================================================
    // LEBAR KOLOM DETAIL
    // ========================================================

    detailSheet.columns = [
      { width: 6 },
      { width: 14 },
      { width: 24 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 14 },
      { width: 18 },
      { width: 16 },
      { width: 18 },
      { width: 16 },
      { width: 30 },
    ];

    detailSheet.views = [
      {
        state: "frozen",
        ySplit: 3,
      },
    ];

    // ========================================================
    // DOWNLOAD
    // ========================================================

    const namaFile = `Laporan_Gaji_${NAMA_BULAN[bulan - 1]}_${tahun}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader("Content-Disposition", `attachment; filename="${namaFile}"`);

    await workbook.xlsx.write(res);

    res.end();
  } catch (error) {
    console.error("Gagal export Excel:", error);

    return res.status(500).json({
      pesan: "Gagal membuat file laporan Excel.",
      detail: error.message,
    });
  }
}

module.exports = {
  exportLaporanExcel,
};

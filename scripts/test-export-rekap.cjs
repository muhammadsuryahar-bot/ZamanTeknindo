const assert = require("assert");
const { PassThrough } = require("stream");
const Module = require("module");

const prismaMock = {
  pengguna: {
    findMany: async () => [
      { id: 1, nama: "Karyawan Satu", jabatan: "Staff", divisi: "Umum", kantor: { namaKantor: "Pekanbaru" } },
      { id: 2, nama: "Karyawan Dua", jabatan: "Staff", divisi: "Finance", kantor: { namaKantor: "Pekanbaru" } },
    ],
  },
  absensi: {
    findMany: async () => [
      {
        penggunaId: 1,
        tanggal: new Date("2026-08-26T00:00:00.000Z"),
        jamMasuk: new Date("2026-08-26T01:05:00.000Z"),
        jamPulang: new Date("2026-08-26T10:00:00.000Z"),
        statusOtomatis: "tepat_waktu",
        statusFinal: "tepat_waktu",
        keterangan: null,
        catatanAdmin: null,
      },
      {
        penggunaId: 1,
        tanggal: new Date("2026-08-27T00:00:00.000Z"),
        jamMasuk: new Date("2026-08-27T01:15:00.000Z"),
        jamPulang: new Date("2026-08-27T10:00:00.000Z"),
        statusOtomatis: "telat",
        statusFinal: "telat",
        keterangan: null,
        catatanAdmin: null,
      },
      {
        penggunaId: 1,
        tanggal: new Date("2026-08-28T00:00:00.000Z"),
        jamMasuk: null,
        jamPulang: null,
        statusOtomatis: "alpha",
        statusFinal: "alpha",
        keterangan: null,
        catatanAdmin: null,
      },
      {
        penggunaId: 2,
        tanggal: new Date("2026-08-26T00:00:00.000Z"),
        jamMasuk: new Date("2026-08-26T01:08:00.000Z"),
        jamPulang: new Date("2026-08-26T10:00:00.000Z"),
        statusOtomatis: "tepat_waktu",
        statusFinal: "tepat_waktu",
        keterangan: null,
        catatanAdmin: null,
      },
    ],
  },
  pengajuanIzin: {
    findMany: async () => [
      {
        id: 10,
        penggunaId: 1,
        tanggal: new Date("2026-09-01T00:00:00.000Z"),
        jenis: "cuti",
        keterangan: "Cuti tahunan",
        fotoSurat: null,
      },
      {
        id: 11,
        penggunaId: 1,
        tanggal: new Date("2026-09-02T00:00:00.000Z"),
        jenis: "sakit",
        keterangan: "Sakit",
        fotoSurat: "surat-sakit.jpg",
      },
      {
        id: 12,
        penggunaId: 1,
        tanggal: new Date("2026-09-03T00:00:00.000Z"),
        jenis: "sakit",
        keterangan: "Sakit",
        fotoSurat: null,
      },
      {
        id: 13,
        penggunaId: 2,
        tanggal: new Date("2026-09-01T00:00:00.000Z"),
        jenis: "izin",
        keterangan: "Keperluan keluarga",
        fotoSurat: null,
      },
    ],
  },
  pengaturanPotongan: {
    findUnique: async () => ({ jamMasukStandar: "08:10:00" }),
  },
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const parentFile = String(parent?.filename || "");
  if (
    parentFile.endsWith("backend/src/controllers/exportRekapAbsensiController.js") &&
    request === "../utils/prismaClient"
  ) {
    return prismaMock;
  }
  if (
    parentFile.endsWith("backend/src/controllers/exportRekapAbsensiController.js") &&
    request === "../utils/hariLibur"
  ) {
    return {
      ambilSetHariLibur: async () => new Set(["2026-09-17"]),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const ExcelJS = require("exceljs");
const { exportRekapAbsensi } = require("../backend/src/controllers/exportRekapAbsensiController");

async function main() {
  const req = {
    query: {
      tanggalMulai: "2026-08-26",
      tanggalSelesai: "2026-09-25",
    },
    get: () => undefined,
  };

  const output = new PassThrough();
  const chunks = [];
  output.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const headers = {};
  output.setHeader = (key, value) => {
    headers[String(key).toLowerCase()] = value;
  };
  output.getHeader = (key) => headers[String(key).toLowerCase()];

  await exportRekapAbsensi(req, output);
  await new Promise((resolve, reject) => {
    if (output.readableEnded) return resolve();
    output.once("finish", resolve);
    output.once("error", reject);
  });
  assert.ok(chunks.length > 0, "Controller harus menghasilkan file XLSX");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.concat(chunks));

  assert.deepStrictEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["Rekap Absensi", "Data Harian"],
    "Workbook wajib memiliki tepat 2 sheet sesuai HRD",
  );

  const rekap = workbook.getWorksheet("Rekap Absensi");
  const harian = workbook.getWorksheet("Data Harian");

  assert.ok(rekap, "Sheet Rekap Absensi harus ada");
  assert.ok(harian, "Sheet Data Harian harus ada");
  assert.strictEqual(rekap.columnCount, 17, "Rekap Absensi harus 17 kolom A:Q");
  assert.strictEqual(harian.columnCount, 33, "Data Harian periode 31 hari harus A:AG");

  assert.strictEqual(rekap.getCell("A4").value, "NO");
  assert.strictEqual(rekap.getCell("B4").value, "NAMA");
  assert.strictEqual(rekap.getCell("H4").value, "JLH KEHADIRAN");
  assert.strictEqual(rekap.getCell("J4").value, "JLH UANG MAKAN\nYANG DIBAYARKAN");
  assert.strictEqual(rekap.getCell("Q4").value, "JLH HC");

  assert.strictEqual(harian.getCell("A4").value, "NO");
  assert.strictEqual(harian.getCell("B4").value, "NAMA");
  assert.strictEqual(harian.getCell("C4").value, "Agu");
  assert.strictEqual(harian.getCell("C5").value, 26);
  assert.strictEqual(harian.getCell("C6").value, "Rab");

  // Data Harian baris 7 dan baris 8 harus terpisah per karyawan.
  assert.strictEqual(harian.getCell("C7").value, "H");
  assert.strictEqual(harian.getCell("D7").value, "T");
  assert.strictEqual(harian.getCell("E7").value, "A");
  assert.strictEqual(harian.getCell("I7").value, "C");
  assert.strictEqual(harian.getCell("J7").value, "S");
  assert.strictEqual(harian.getCell("K7").value, "SX");
  assert.strictEqual(harian.getCell("C8").value, "H");

  // Rekap harus mengambil sumber dari baris Data Harian karyawan yang sama.
  assert.match(String(rekap.getCell("H7").value.formula), /'Data Harian'!\$C7:\$AG7/);
  assert.match(String(rekap.getCell("H8").value.formula), /'Data Harian'!\$C8:\$AG8/);
  assert.strictEqual(rekap.getCell("I7").value.result, 1);
  assert.strictEqual(rekap.getCell("N7").value.result, 1);
  assert.strictEqual(rekap.getCell("O7").value.result, 1);
  assert.strictEqual(rekap.getCell("P7").value.result, 1);

  // 17 September harus ditandai L ketika tidak ada data.
  const sep17Index = 22; // 26 Aug + 22 hari = 17 Sep
  assert.strictEqual(harian.getCell(7, 3 + sep17Index).value, "L");

  console.log("Export rekap 2-sheet integration test: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

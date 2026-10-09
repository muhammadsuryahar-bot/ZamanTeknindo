const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const baca = (file) => fs.readFileSync(path.join(root, file), "utf8");

const karyawan = baca("src/pages/DashboardKaryawan.jsx");
const main = baca("src/main.jsx");
const middleware = baca("backend/src/middleware/kompresFoto.js");
const controller = baca("backend/src/controllers/absensiController.js");

const mulaiKirim = karyawan.indexOf("  async function kirimAbsen()");
const akhirKirim = karyawan.indexOf("\n\n  // Gunakan tahap tampilan", mulaiKirim);
assert(mulaiKirim >= 0 && akhirKirim > mulaiKirim, "Fungsi kirimAbsen harus tersedia untuk audit performa.");
const alurKirim = karyawan.slice(mulaiKirim, akhirKirim);

assert(!alurKirim.includes("segarkanStatusUntukKirim"), "Kirim Absen tidak boleh menunggu request status tambahan setelah tombol ditekan.");
assert(!alurKirim.includes("/status-hari-ini"), "Kirim Absen tidak boleh melakukan GET status sebelum upload foto.");
assert(alurKirim.includes("waktuServerEpochMs"), "Pemilihan Masuk/Pulang harus memakai jam server yang berjalan.");
assert(alurKirim.includes("${API_URL}/absensi/${endpoint}"), "Foto harus dikirim melalui endpoint absensi yang dipilih.");

assert(middleware.includes("Promise.all(["), "Pengecekan status sebelum upload harus paralel.");
assert(middleware.includes("req.absensiPreflight = { penggunaId, tanggal, absensi, route }"), "Middleware harus meneruskan hasil preflight ke controller.");
assert(!middleware.includes("BELUM_JAM_PULANG"), "Mode testing clock-out tidak boleh diblokir oleh batas 17:00 pada middleware.");
assert(!middleware.includes("JAM_PULANG_STANDAR_DEFAULT"), "Middleware tidak boleh menghidupkan kembali batas clock-out dari env.");
assert(middleware.includes("menitValidasi < BATAS_ABSEN_MASUK_WIB"), "Aturan clock-out tanpa absen masuk sebelum 12:00 tetap harus dijaga.");

assert(controller.includes("preflightMasuk?.absensi"), "Controller masuk harus memakai snapshot preflight untuk mengurangi query berulang.");
assert(controller.includes("preflightPulang?.absensi"), "Controller pulang harus memakai snapshot preflight untuk mengurangi query berulang.");
assert(controller.includes("waktuServerEpochMs: waktuServerSekarang.getTime()"), "Status API harus menyediakan timestamp server presisi.");

assert(karyawan.includes("window.__zamanAbsensiSedangBerlangsung"), "Halaman Karyawan harus mengunci update saat sesi absensi aktif.");
assert(main.includes("window.__zamanAbsensiSedangBerlangsung === true"), "PWA updater harus mengenali sesi absensi aktif.");
assert(main.includes("if (!sesiAbsensiMasihBerlangsung())"), "PWA updater hanya boleh reload setelah sesi absensi selesai.");

console.log("Absensi submit performance + PWA auto-update regression test: PASS");

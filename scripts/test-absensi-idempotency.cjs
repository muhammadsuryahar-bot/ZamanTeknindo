const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const routing = read("src/utils/alurAbsensi.js");
const dashboard = read("src/pages/DashboardKaryawan.jsx");
const middleware = read("backend/src/middleware/kompresFoto.js");
const controller = read("backend/src/controllers/absensiController.js");

assert(routing.includes('return menitWIB >= BATAS_ABSEN_MASUK_WIB ? "pulang" : null;'),
  "Routing client tidak boleh memilih endpoint pulang sebelum 12:00 WIB.");

const submitStart = dashboard.indexOf("  async function kirimAbsen()");
const submitEnd = dashboard.indexOf("// Gunakan tahap tampilan", submitStart);
assert(submitStart >= 0 && submitEnd > submitStart, "Fungsi kirimAbsen harus tersedia.");
const submit = dashboard.slice(submitStart, submitEnd);
assert(submit.includes("if (sesiKirimRef.current || loading || absensiTerkirimRef.current) return;"),
  "Klik kedua saat request berjalan atau setelah sukses harus ditolak.");
assert(submit.includes("absensiTerkirimRef.current = true;"),
  "Submit lock harus aktif secara sinkron setelah hasil tersimpan.");
assert(submit.includes("absensiTerkirimRef.current = false;"),
  "Submit lock harus bisa di-reset untuk foto baru atau tanggal absensi berikutnya.");

const clockoutGate = middleware.indexOf('if (route === "/pulang" && menitValidasi < BATAS_ABSEN_MASUK_WIB)');
assert(clockoutGate >= 0, "Middleware wajib memblokir semua clock-out sebelum pukul 12:00.");
assert(middleware.includes('kode: "ABSEN_PULANG_TERLALU_AWAL"'),
  "Middleware wajib mengirim kode penolakan clock-out dini.");
assert(middleware.includes('res.status(200).json({\n        tahap: "selesai",\n        pesan: "Absen pulang sudah tercatat. Tidak perlu dikirim ulang."'),
  "Submit ulang setelah clock-out tersimpan harus menjadi sukses idempoten, tanpa upload Storage kedua.");

const controllerStart = controller.indexOf("async function absenPulang");
const controllerEnd = controller.indexOf("async function riwayatSaya", controllerStart);
assert(controllerStart >= 0 && controllerEnd > controllerStart, "Controller pulang harus dapat ditemukan.");
const clockout = controller.slice(controllerStart, controllerEnd);
assert(clockout.includes("if (menitSekarangWIB(new Date()) < BATAS_ABSEN_MASUK_WIB)"),
  "Controller wajib memeriksa batas waktu server secara mandiri.");
assert(clockout.includes("where: { id: absensiHariIni.id, jamPulang: null }"),
  "Penyimpanan pulang harus berupa update bersyarat atomik hanya ketika jamPulang masih kosong.");
assert(clockout.includes('if (error?.code === "P2025")') && clockout.includes("const absensiFinal = await prisma.absensi.findUnique"),
  "Request bersamaan harus membaca hasil akhir setelah kalah pada update atomik.");
assert(clockout.includes('if (error?.code === "P2002")') && clockout.includes("if (absensiFinal?.jamPulang)"),
  "Request bersamaan yang membuat row baru harus mendeteksi unique conflict dan mengembalikan catatan pulang yang tersimpan.");
assert(clockout.includes('return res.status(200).json({\n              pesan: "Absen pulang sudah tercatat. Tidak perlu dikirim ulang."'),
  "Race submit kedua yang kalah harus diselesaikan sebagai sudah tersimpan, bukan meminta klik lagi.");

console.log("Absensi clock-out cutoff + idempotency regression test: PASS");
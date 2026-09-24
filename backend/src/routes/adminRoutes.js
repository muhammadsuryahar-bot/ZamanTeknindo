
const express = require("express");
const multer = require("multer");
const router = express.Router();
const { cekLogin, cekAdmin } = require("../middleware/authMiddleware");
const { batasResetPassword } = require("../middleware/rateLimiter");
const {
  daftarMenungguKonfirmasiFixed,
  editStatusAbsensiFixed,
  ambilPengaturanPotonganFixed,
  ubahPengaturanPotonganFixed,
  daftarGajiKaryawanFixed,
  ubahGajiKaryawanFixed,
  daftarHariLiburFixed,
  tambahHariLiburFixed,
  hapusHariLiburFixed,
  usulanHariLiburFixed,
} = require("../controllers/adminFinanceFixedController");
const {
  ringkasanDashboardFixed,
  notifikasiAdminFixed,
  ubahStatusKaryawanFixed,
} = require("../controllers/adminOperationalFixedController");
const { aktifkanAkunFixed } = require("../controllers/aktivasiAkunFixedController");
const { daftarKaryawanFixed } = require("../controllers/adminKaryawanFixedController");
const {
  rekapHariIniFixed,
  ambilRekapTanggal,
  ubahStatusTanpaAbsensi,
} = require("../controllers/rekapAbsensiFixedController");
const { daftarKantorFixed, tambahKantorFixed, ubahKantorFixed } = require("../controllers/kantorControllerFixed");
const { ubahProfilKaryawan } = require("../controllers/adminProfilKaryawanController");
const {
  templateGajiMassal,
  previewGajiMassal,
  simpanGajiMassal,
} = require("../controllers/gajiMassalController");
const { resetPasswordOlehAdmin } = require("../controllers/authController");
const {
  hitungDanSimpanSatu,
  hitungDanSimpanSemua,
  lihatLaporanBulanan,
} = require("../controllers/hitungGajiController");
const { exportLaporanExcel } = require("../controllers/exportGajiController");

// NEW - Manual Verifikasi Controller
const {
  getManualPending,
  approveManual,
  rejectManual,
} = require("../controllers/adminManualController");

router.use(cekLogin, cekAdmin);

router.use((req, res, next) => {
  const jsonAsli = res.json.bind(res);
  res.json = (body) => {
    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      Object.prototype.hasOwnProperty.call(body, "detail")
    ) {
      const { detail, ...aman } = body;
      return jsonAsli(aman);
    }
    return jsonAsli(body);
  };
  next();
});

const STATUS_AKUN_VALID = new Set(["aktif", "nonaktif"]);
function validasiStatusAkun(req, res, next) {
  const statusAkun = String(req.body?.statusAkun || "").trim();
  if (!STATUS_AKUN_VALID.has(statusAkun)) {
    return res.status(400).json({ pesan: "Status akun tidak valid. Gunakan hanya 'aktif' atau 'nonaktif'." });
  }
  next();
}

const STATUS_FINAL_VALID = new Set(["tepat_waktu", "telat", "alpha", "izin", "sakit", "cuti", "urgent"]);
function validasiEditStatusAbsensi(req, res, next) {
  const statusFinal = String(req.body?.statusFinal || "").trim();
  const catatanAdmin = String(req.body?.catatanAdmin || "").trim();
  if (!STATUS_FINAL_VALID.has(statusFinal)) {
    return res.status(400).json({ pesan: "Status absensi tidak valid." });
  }
  if (!catatanAdmin) {
    return res.status(400).json({ pesan: "Catatan wajib diisi." });
  }
  next();
}

function validasiNominalNonNegatif(field, label) {
  return (req, res, next) => {
    const raw = req.body?.[field];
    if (raw == null || String(raw).trim() === "") {
      return res.status(400).json({ pesan: `${label} wajib diisi.` });
    }
    const nilai = Number(raw);
    if (!Number.isFinite(nilai) || nilai < 0) {
      return res.status(400).json({ pesan: `${label} harus angka valid.` });
    }
    req.body[field] = nilai;
    next();
  };
}

function validasiPengaturanPotongan(req, res, next) {
  const jamMasuk = String(req.body?.jamMasukStandar || "08:10:00").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(jamMasuk)) {
    return res.status(400).json({ pesan: "Jam masuk tidak valid." });
  }
  req.body.jamMasukStandar = jamMasuk;
  next();
}

function validasiTanggalHariLibur(req, res, next) {
  const nilai = String(req.body?.tanggal || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) {
    return res.status(400).json({ pesan: "Tanggal harus YYYY-MM-DD." });
  }
  req.body.tanggal = nilai;
  next();
}

const uploadExcelGaji = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const nama = String(file.originalname || "").toLowerCase();
    if (!nama.endsWith(".xlsx")) {
      return cb(new Error("Hanya .xlsx"));
    }
    cb(null, true);
  },
});

router.get("/akun-menunggu", daftarMenungguKonfirmasiFixed);
router.get("/notifikasi", notifikasiAdminFixed);
router.put("/akun/:id/aktifkan", aktifkanAkunFixed);

router.get("/karyawan", daftarKaryawanFixed);
router.put("/karyawan/:id", ubahProfilKaryawan);
router.put("/karyawan/:id/status", validasiStatusAkun, ubahStatusKaryawanFixed);
router.put("/karyawan/:id/reset-password", batasResetPassword, resetPasswordOlehAdmin);

router.get("/rekap-hari-ini", rekapHariIniFixed);
router.get("/rekap-tanggal", ambilRekapTanggal);
router.put("/absensi/tanggal/:tanggal/pengguna/:penggunaId/status", validasiEditStatusAbsensi, ubahStatusTanpaAbsensi);
router.get("/ringkasan", ringkasanDashboardFixed);
router.put("/absensi/:id/edit-status", editStatusAbsensiFixed);

router.get("/pengaturan-potongan", ambilPengaturanPotonganFixed);
router.put("/pengaturan-potongan", validasiNominalNonNegatif("potonganTelat", "Potongan telat"), validasiNominalNonNegatif("potonganAlpha", "Potongan alpha"), validasiPengaturanPotongan, ubahPengaturanPotonganFixed);

router.get("/gaji", daftarGajiKaryawanFixed);
router.put("/gaji/:id/atur", validasiNominalNonNegatif("gajiPokok", "Gaji pokok"), ubahGajiKaryawanFixed);
router.post("/gaji/hitung/:penggunaId", hitungDanSimpanSatu);
router.post("/gaji/hitung-semua", hitungDanSimpanSemua);
router.get("/gaji/laporan", lihatLaporanBulanan);
router.get("/gaji/export", exportLaporanExcel);

router.get("/gaji/template-massal", templateGajiMassal);
router.post("/gaji/import-preview", (req, res, next) => {
  uploadExcelGaji.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ pesan: err.message });
    next();
  });
}, previewGajiMassal);
router.post("/gaji/import-simpan", simpanGajiMassal);

router.get("/kantor", daftarKantorFixed);
router.post("/kantor", tambahKantorFixed);
router.put("/kantor/:id", ubahKantorFixed);

router.get("/hari-libur", daftarHariLiburFixed);
router.post("/hari-libur", validasiTanggalHariLibur, tambahHariLiburFixed);
router.delete("/hari-libur/:id", hapusHariLiburFixed);
router.get("/hari-libur-usulan", usulanHariLiburFixed);

// ===== NEW: Verifikasi Manual - Backup Kiosk (TANPA PIN di kiosk) =====
router.get("/manual-pending", getManualPending);
router.post("/manual-approve/:id", approveManual);
router.post("/manual-reject/:id", rejectManual);

module.exports = router;

const express = require("express");
const multer = require("multer");
const router = express.Router();
const { cekLogin, cekAdmin } = require("../middleware/authMiddleware");
const {
  daftarMenungguKonfirmasi,
  editStatusAbsensi,
  ubahPengaturanPotongan,
  daftarGajiKaryawan,
  ubahGajiKaryawan,
  daftarHariLibur,
  tambahHariLibur,
  hapusHariLibur,
  usulanHariLibur,
} = require("../controllers/adminController");
const {
  ringkasanDashboardFixed,
  notifikasiAdminFixed,
  ambilPengaturanPotonganFixed,
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
    return res.status(400).json({ pesan: "Status absensi tidak valid. Gunakan status tepat_waktu, telat, alpha, izin, sakit, cuti, atau urgent." });
  }
  if (!catatanAdmin) {
    return res.status(400).json({ pesan: "Catatan wajib diisi kalau mengubah status absensi secara manual." });
  }
  if (catatanAdmin.length > 500) {
    return res.status(400).json({ pesan: "Catatan Admin maksimal 500 karakter." });
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
      return res.status(400).json({ pesan: `${label} harus berupa angka yang valid dan tidak boleh negatif.` });
    }

    req.body[field] = nilai;
    next();
  };
}

function validasiPengaturanPotongan(req, res, next) {
  const jamMasuk = String(req.body?.jamMasukStandar || "08:10:00").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(jamMasuk)) {
    return res.status(400).json({ pesan: "Jam masuk standar tidak valid. Gunakan format HH:MM atau HH:MM:SS." });
  }
  req.body.jamMasukStandar = jamMasuk;
  next();
}

function validasiTanggalHariLibur(req, res, next) {
  const nilai = String(req.body?.tanggal || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) {
    return res.status(400).json({ pesan: "Tanggal hari libur harus menggunakan format YYYY-MM-DD." });
  }

  const [tahun, bulan, hari] = nilai.split("-").map(Number);
  const kandidat = new Date(Date.UTC(tahun, bulan - 1, hari));
  const valid =
    kandidat.getUTCFullYear() === tahun &&
    kandidat.getUTCMonth() === bulan - 1 &&
    kandidat.getUTCDate() === hari;

  if (!valid) {
    return res.status(400).json({ pesan: "Tanggal hari libur tidak valid." });
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
      return cb(new Error("Hanya file Excel .xlsx yang diperbolehkan."));
    }
    cb(null, true);
  },
});

router.get("/akun-menunggu", daftarMenungguKonfirmasi);
router.get("/notifikasi", notifikasiAdminFixed);
router.put("/akun/:id/aktifkan", aktifkanAkunFixed);

router.get("/karyawan", daftarKaryawanFixed);
router.put("/karyawan/:id", ubahProfilKaryawan);
router.put("/karyawan/:id/status", validasiStatusAkun, ubahStatusKaryawanFixed);
router.put("/karyawan/:id/reset-password", resetPasswordOlehAdmin);

router.get("/rekap-hari-ini", rekapHariIniFixed);
router.get("/rekap-tanggal", ambilRekapTanggal);
router.put(
  "/absensi/tanggal/:tanggal/pengguna/:penggunaId/status",
  validasiEditStatusAbsensi,
  ubahStatusTanpaAbsensi,
);
router.get("/ringkasan", ringkasanDashboardFixed);
router.put("/absensi/:id/edit-status", validasiEditStatusAbsensi, editStatusAbsensi);

router.get("/pengaturan-potongan", ambilPengaturanPotonganFixed);
router.put(
  "/pengaturan-potongan",
  validasiNominalNonNegatif("potonganTelat", "Potongan telat"),
  validasiNominalNonNegatif("potonganAlpha", "Potongan alpha"),
  validasiPengaturanPotongan,
  ubahPengaturanPotongan,
);

router.get("/gaji", daftarGajiKaryawan);
router.put(
  "/gaji/:id/atur",
  validasiNominalNonNegatif("gajiPokok", "Gaji pokok"),
  ubahGajiKaryawan,
);
router.post("/gaji/hitung/:penggunaId", hitungDanSimpanSatu);
router.post("/gaji/hitung-semua", hitungDanSimpanSemua);
router.get("/gaji/laporan", lihatLaporanBulanan);
router.get("/gaji/export", exportLaporanExcel);

router.get("/gaji/template-massal", templateGajiMassal);
router.post("/gaji/import-preview", (req, res, next) => {
  uploadExcelGaji.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ pesan: err.message || "File Excel tidak valid." });
    next();
  });
}, previewGajiMassal);
router.post("/gaji/import-simpan", simpanGajiMassal);

router.get("/kantor", daftarKantorFixed);
router.post("/kantor", tambahKantorFixed);
router.put("/kantor/:id", ubahKantorFixed);

router.get("/hari-libur", daftarHariLibur);
router.post("/hari-libur", validasiTanggalHariLibur, tambahHariLibur);
router.delete("/hari-libur/:id", hapusHariLibur);
router.get("/hari-libur-usulan", usulanHariLibur);

module.exports = router;

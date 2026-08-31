const express = require("express");
const router = express.Router();
const { cekLogin, cekAdmin } = require("../middleware/authMiddleware");
const {
  daftarMenungguKonfirmasi,
  aktifkanAkun,
  daftarKaryawan,
  ubahStatusKaryawan,
  rekapHariIni,
  ringkasanDashboard,
  editStatusAbsensi,
  ambilPengaturanPotongan,
  ubahPengaturanPotongan,
  daftarGajiKaryawan,
  ubahGajiKaryawan,
  daftarKantor,
  tambahKantor,
  ubahKantor,
  daftarHariLibur,
  tambahHariLibur,
  hapusHariLibur,
  usulanHariLibur,
  notifikasiAdmin,
} = require("../controllers/adminController");

const { resetPasswordOlehAdmin } = require("../controllers/authController");
const { hapusAkunKaryawan } = require("../controllers/hapusAkunKaryawanController");

const {
  hitungDanSimpanSatu,
  hitungDanSimpanSemua,
  lihatLaporanBulanan,
} = require("../controllers/hitungGajiController");

const { exportLaporanExcel } = require("../controllers/exportGajiController");

router.use(cekLogin, cekAdmin);

// Redaksi detail internal dari response admin.
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
    return res.status(400).json({
      pesan: "Status akun tidak valid. Gunakan hanya 'aktif' atau 'nonaktif'.",
    });
  }

  next();
}

const STATUS_FINAL_VALID = new Set([
  "tepat_waktu",
  "telat",
  "alpha",
  "izin",
  "sakit",
  "cuti",
  "urgent",
]);

function validasiEditStatusAbsensi(req, res, next) {
  const statusFinal = String(req.body?.statusFinal || "").trim();
  const catatanAdmin = String(req.body?.catatanAdmin || "").trim();

  if (!STATUS_FINAL_VALID.has(statusFinal)) {
    return res.status(400).json({
      pesan:
        "Status absensi tidak valid. Gunakan status tepat_waktu, telat, alpha, izin, sakit, cuti, atau urgent.",
    });
  }

  if (!catatanAdmin) {
    return res.status(400).json({
      pesan: "Catatan wajib diisi kalau mengubah status absensi secara manual.",
    });
  }

  if (catatanAdmin.length > 500) {
    return res.status(400).json({
      pesan: "Catatan Admin maksimal 500 karakter.",
    });
  }

  next();
}

router.get("/akun-menunggu", daftarMenungguKonfirmasi);
router.get("/notifikasi", notifikasiAdmin);
router.put("/akun/:id/aktifkan", aktifkanAkun);

router.get("/karyawan", daftarKaryawan);
router.put("/karyawan/:id/status", validasiStatusAkun, ubahStatusKaryawan);
router.delete("/karyawan/:id", hapusAkunKaryawan);
router.put("/karyawan/:id/reset-password", resetPasswordOlehAdmin);

router.get("/rekap-hari-ini", rekapHariIni);
router.get("/ringkasan", ringkasanDashboard);
router.put(
  "/absensi/:id/edit-status",
  validasiEditStatusAbsensi,
  editStatusAbsensi,
);

router.get("/pengaturan-potongan", ambilPengaturanPotongan);
router.put("/pengaturan-potongan", ubahPengaturanPotongan);

router.get("/gaji", daftarGajiKaryawan);
router.put("/gaji/:id/atur", ubahGajiKaryawan);
router.post("/gaji/hitung/:penggunaId", hitungDanSimpanSatu);
router.post("/gaji/hitung-semua", hitungDanSimpanSemua);
router.get("/gaji/laporan", lihatLaporanBulanan);
router.get("/gaji/export", exportLaporanExcel);

router.get("/kantor", daftarKantor);
router.post("/kantor", tambahKantor);
router.put("/kantor/:id", ubahKantor);

router.get("/hari-libur", daftarHariLibur);
router.post("/hari-libur", tambahHariLibur);
router.delete("/hari-libur/:id", hapusHariLibur);
router.get("/hari-libur-usulan", usulanHariLibur);

module.exports = router;

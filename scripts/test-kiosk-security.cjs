const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File tidak ditemukan: ${relativePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

const kioskPage = read("src/pages/Kiosk.jsx");
const kioskRoutes = read("backend/src/routes/kiosk.js");
const kioskController = read("backend/src/controllers/kioskController.js");
const authMiddleware = read("backend/src/middleware/authMiddleware.js");
const appRouter = read("src/App.jsx");
const adminFinance = read("backend/src/controllers/adminFinanceFixedController.js");
const schema = read("backend/prisma/schema.prisma");

assert(
  kioskPage.includes('Authorization: `Bearer ${adminToken}`'),
  "Manual fallback Kiosk wajib mengirim Bearer adminToken.",
);
assert(
  kioskRoutes.includes(
    "router.post('/manual-fallback', checkKioskAdminSession, kioskController.submitManualFallback);",
  ),
  "Route manual fallback Kiosk wajib dilindungi checkKioskAdminSession.",
);
assert(
  kioskRoutes.includes(
    "router.post('/absen', checkKioskAttendanceToken, kioskController.kioskAbsen);",
  ),
  "Route absen Kiosk wajib dilindungi checkKioskAttendanceToken.",
);
assert(
  kioskController.includes('decoded?.scope !== scope'),
  "Kiosk JWT wajib divalidasi berdasarkan scope.",
);
assert(
  kioskRoutes.includes(
    "router.post('/recognize', batasKioskRecognition, kioskController.recognize);",
  ),
  "Route face recognition Kiosk wajib memiliki rate limit.",
);
assert(
  kioskController.includes('bcrypt.compare(inputPin, adminPin)'),
  "Verifikasi PIN Kiosk wajib mendukung hash bcrypt.",
);
assert(
  !kioskController.includes('return res.json({ data });'),
  "Controller Kiosk tidak boleh mengembalikan pengaturan sensitif mentah.",
);
assert(
  authMiddleware.includes('dataToken?.scope'),
  "JWT berscope Kiosk wajib ditolak oleh auth aplikasi biasa.",
);
assert(
  appRouter.includes('import DashboardKaryawan from "./pages/DashboardKaryawan";'),
  "DashboardKaryawan harus di-import langsung agar route utama tidak bergantung dynamic chunk.",
);
assert(
  !appRouter.includes('const DashboardKaryawan = lazy('),
  "DashboardKaryawan tidak boleh kembali menjadi lazy import.",
);

const forbiddenLegacySecrets = [
  "kiosk_rahasia_zaman_2025",
  "KIOSK_SECRET_KEY",
  "VITE_KIOSK_KEY",
  "x-kiosk-key",
];
for (const secret of forbiddenLegacySecrets) {
  assert(!kioskPage.includes(secret), `Secret Kiosk lama masih ada di frontend: ${secret}`);
  assert(!kioskController.includes(secret), `Secret Kiosk lama masih ada di backend: ${secret}`);
  assert(!kioskRoutes.includes(secret), `Secret Kiosk lama masih ada di route: ${secret}`);
}

assert(
  !adminFinance.includes('"246810"') && !adminFinance.includes("'246810'"),
  "Fallback PIN Kiosk 246810 tidak boleh ada di controller Admin.",
);
assert(
  schema.includes('kioskPin        String   @map("kiosk_pin")') &&
    !schema.includes('@default("246810")'),
  "Schema Kiosk PIN tidak boleh memiliki default PIN lemah.",
);

const gpsValidationAnchor = "akurasiNumber > 100";
assert(
  kioskController.includes(gpsValidationAnchor),
  "Server Kiosk wajib menolak GPS dengan akurasi di atas 100 meter.",
);
assert(
  kioskPage.includes("enableHighAccuracy: true") &&
    kioskPage.includes("maximumAge: 0"),
  "Frontend Kiosk wajib meminta GPS presisi tinggi tanpa cache.",
);

console.log("Kiosk security regression test: PASS");

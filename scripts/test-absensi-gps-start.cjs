const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sourcePath = path.join(__dirname, "..", "src", "pages", "DashboardKaryawan.jsx");
const source = fs.readFileSync(sourcePath, "utf8");

const bukaKameraStart = source.indexOf("async function bukaKamera()");
assert.notEqual(bukaKameraStart, -1, "bukaKamera must exist");
const bukaKameraEnd = source.indexOf("\n  useEffect(() => {", bukaKameraStart);
assert.notEqual(bukaKameraEnd, -1, "bukaKamera block must end before camera preview effect");
const bukaKamera = source.slice(bukaKameraStart, bukaKameraEnd);

assert.match(
  bukaKamera,
  /setKameraAktif\(true\);\s*\/\/ Mulai GPS segera setelah izin kamera didapat, tanpa menunggu preview video siap\.\s*\/\/ GPS dan preview kamera berjalan paralel; batas akurasi tetap sama\.\s*ambilLokasi\(\);/,
  "GPS must start immediately after camera permission/stream succeeds, parallel to video preview",
);
assert.doesNotMatch(
  source,
  /jadwalkanLokasiSetelahKameraSiap/,
  "GPS must no longer wait for camera-preview readiness or start through a stale scheduler",
);
assert.match(source, /const LOKASI_REQUEST_TIMEOUT_MS = 20000;/, "GPS timeout stays 20 seconds");
assert.match(source, /const LOKASI_AKURASI_FALLBACK_METER = 100;/, "maximum accepted GPS accuracy stays 100 meters");
assert.match(source, /const LOKASI_FALLBACK_FINISH_MS = 3000;/, "fallback wait stays 3 seconds");
assert.match(source, /enableHighAccuracy: true, maximumAge: 0, timeout: LOKASI_REQUEST_TIMEOUT_MS/, "high accuracy and fresh GPS fixes remain enabled");
assert.match(source, /if \(akurasi <= 20\)/, "preferred finish threshold remains 20 meters");

console.log("Absensi GPS parallel-start regression test: PASS");

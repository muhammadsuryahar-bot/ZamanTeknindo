const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const baca = (file) => fs.readFileSync(path.join(root, file), "utf8");

const controller = baca("backend/src/controllers/authController.js");
const adminRoutes = baca("backend/src/routes/adminRoutes.js");
const rateLimiter = baca("backend/src/middleware/rateLimiter.js");
const authRoutes = baca("backend/src/routes/authRoutes.js");
const gantiPassword = baca("src/pages/GantiPassword.jsx");
const dashboardAdmin = baca("src/pages/DashboardAdmin.jsx");
const packageJson = JSON.parse(baca("package.json"));

assert(controller.includes("function buatPasswordSementara()"), "Generator password sementara harus tersedia.");
assert(controller.includes("crypto.randomInt(0, karakter.length)"), "Generator harus memakai randomness kriptografis.");
assert(/for \(let i = 0; i < 12; i\+\+\)/.test(controller), "Password sementara harus mempunyai 12 karakter.");
assert(controller.includes('if (pengguna.peran !== "karyawan")'), "Reset tidak boleh menargetkan akun non-karyawan.");
assert(controller.includes("await bcrypt.hash(passwordSementara, 10)"), "Password sementara harus di-hash dengan bcrypt.");
assert(controller.includes('data: { kataSandi: passwordBaruHash }'), "Hash password sementara harus disimpan ke database.");
assert(controller.includes('"Cache-Control": "no-store, no-cache, must-revalidate, private"'), "Respons reset wajib dilarang masuk cache.");
assert(controller.includes('"Surrogate-Control": "no-store"'), "Respons reset wajib dilarang masuk cache proxy/CDN.");

const guardPos = adminRoutes.indexOf("router.use(cekLogin, cekAdmin);");
const routePos = adminRoutes.indexOf('router.put("/karyawan/:id/reset-password", batasResetPassword, resetPasswordOlehAdmin);');
assert(guardPos >= 0 && routePos > guardPos, "Endpoint reset wajib berada di belakang autentikasi dan otorisasi Admin.");
assert(rateLimiter.includes("const batasResetPassword = rateLimit("), "Rate limit reset wajib tersedia.");
assert(/const batasResetPassword = rateLimit\(\{[\s\S]*?max: 5,/.test(rateLimiter), "Reset password wajib dibatasi maksimal 5 percobaan per 15 menit.");
assert(authRoutes.includes('router.put("/ganti-password", cekLogin, batasGantiPassword, gantiPassword);'), "Ganti password wajib membutuhkan login dan rate limit.");
assert(controller.includes("await bcrypt.compare(passwordLama, pengguna.kataSandi)"), "Ganti password wajib memverifikasi password lama.");
assert(controller.includes("await bcrypt.hash(passwordBaru, 10)"), "Password baru wajib di-hash dengan bcrypt.");
assert(dashboardAdmin.includes("resetPasswordKonfirmasi"), "Reset melalui Admin harus meminta konfirmasi eksplisit.");
assert(dashboardAdmin.includes("konfirmasiResetPassword"), "Konfirmasi reset harus memiliki handler tersendiri.");
assert(dashboardAdmin.includes("resetPasswordHasil.password"), "Password sementara hanya ditampilkan melalui state hasil reset.");
assert(dashboardAdmin.includes("setSedangResetPasswordId"), "UI wajib mencegah request reset ganda saat sedang diproses.");
assert(gantiPassword.includes('fetch(`${API_URL}/auth/ganti-password`'), "Halaman ganti password harus memanggil endpoint backend yang benar.");
assert(packageJson.scripts["vercel-build"].includes("scripts/test-reset-password.cjs"), "Tes reset password wajib berjalan pada build Vercel.");

console.log("Admin reset password security regression test: PASS");

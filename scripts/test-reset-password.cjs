const fs = require("fs");
const path = require("path");

const root = process.cwd();
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
function assert(ok, message) {
  if (!ok) throw new Error(message);
}

const controller = read("backend/src/controllers/authController.js");
const routes = read("backend/src/routes/authRoutes.js");
const rateLimiter = read("backend/src/middleware/rateLimiter.js");
const schema = read("backend/prisma/schema.prisma");
const migration = read("backend/prisma/migrations/20261009095000_self_service_password_reset/migration.sql");
const login = read("src/pages/Login.jsx");

assert(controller.includes('crypto.randomBytes(32).toString("hex")'), "Token reset harus dibuat memakai random bytes kriptografis.");
assert(controller.includes('crypto.createHash("sha256").update(token).digest("hex")'), "Database hanya boleh menyimpan hash token.");
assert(controller.includes("MASA_BERLAKU_RESET_PASSWORD_MS = 30 * 60 * 1000"), "Token reset harus kedaluwarsa setelah 30 menit.");
assert(controller.includes("JEDA_EMAIL_RESET_PASSWORD_MS = 60 * 1000"), "Permintaan reset per akun harus memiliki cooldown.");
assert(controller.includes("passwordResetTokenExpiresAt: { gt: sekarang }"), "Token reset harus diperiksa masa berlakunya.");
assert(controller.includes("passwordResetTokenHash: null"), "Token harus dihapus setelah dipakai atau pengiriman email gagal.");
assert(controller.includes('process.env.RESEND_API_KEY') && controller.includes('process.env.RESET_PASSWORD_FROM'), "Pengiriman email harus memakai environment server, tidak boleh secret frontend.");
assert(controller.includes('https://api.resend.com/emails'), "Email reset harus dikirim melalui endpoint provider email.");
assert(routes.includes('router.post("/lupa-password", batasLupaPassword, mintaResetPassword)'), "Endpoint meminta tautan reset wajib dipasang dengan rate limit.");
assert(routes.includes('router.post("/reset-password", batasResetPasswordMandiri, resetPasswordDenganToken)'), "Endpoint menyetel password baru wajib dipasang dengan rate limit.");
assert(rateLimiter.includes("max: 5") && rateLimiter.includes("max: 10"), "Endpoint reset wajib memiliki pembatasan percobaan.");
assert(schema.includes('password_reset_token_hash') && schema.includes('password_reset_token_expires_at') && schema.includes('password_reset_requested_at'), "Field token reset wajib ada di Prisma schema.");
assert(migration.includes("ADD COLUMN IF NOT EXISTS") && migration.includes("CREATE INDEX IF NOT EXISTS"), "Migrasi reset password wajib aman dijalankan ulang.");
assert(login.includes("/auth/lupa-password") && login.includes("/auth/reset-password"), "UI login wajib terhubung ke kedua endpoint.");
assert(login.includes("resetToken") && login.includes("konfirmasiKataSandiBaru"), "UI reset wajib mendukung token email dan konfirmasi password.");
console.log("Password reset security regression test: PASS");

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
const login = baca("src/pages/Login.jsx");
const resetPasswordPage = baca("src/pages/ResetPassword.jsx");
const app = baca("src/App.jsx");
const dashboardAdmin = baca("src/pages/DashboardAdmin.jsx");
const dashboardKaryawan = baca("src/pages/DashboardKaryawan.jsx");
const packageJson = JSON.parse(baca("package.json"));
const envExample = baca(".env.example");
const recoveryAdminController = baca("backend/src/controllers/passwordRecoveryAdminController.js");
const adminOperational = baca("backend/src/controllers/adminOperationalFixedController.js");
const adminRecoveryPage = baca("src/pages/AdminPermintaanResetPassword.jsx");
const prismaSchema = baca("backend/prisma/schema.prisma");

// Admin must never set, generate, receive, or display an employee password.
assert(!controller.includes("buatPasswordSementara"), "Generator password sementara Admin harus dihapus.");
assert(!controller.includes("resetPasswordOlehAdmin"), "Controller reset password Admin harus dihapus.");
assert(!controller.includes("passwordSementara"), "Backend tidak boleh membuat atau mengembalikan password sementara.");
assert(!adminRoutes.includes('/karyawan/:id/reset-password'), "Admin tidak boleh memiliki endpoint untuk mengganti password karyawan.");
assert(!rateLimiter.includes("batasResetPassword,"), "Rate limiter endpoint reset Admin harus dihapus.");
assert(!dashboardAdmin.includes("resetPasswordKonfirmasi"), "Dashboard Admin tidak boleh memiliki konfirmasi reset password karyawan.");
assert(!dashboardAdmin.includes("resetPasswordHasil"), "Dashboard Admin tidak boleh menampilkan password karyawan.");
assert(!dashboardAdmin.includes(">Reset Password<"), "Dashboard Admin tidak boleh menyediakan tombol reset password karyawan.");

// Employee can change a known password after login.
assert(authRoutes.includes('router.put("/ganti-password", cekLogin, batasGantiPassword, gantiPassword);'), "Ganti password wajib membutuhkan login dan rate limit.");
assert(controller.includes("await bcrypt.compare(passwordLama, pengguna.kataSandi)"), "Ganti password wajib memverifikasi password lama.");
assert(controller.includes("await bcrypt.hash(passwordBaru, 10)"), "Password baru wajib di-hash dengan bcrypt.");
assert(gantiPassword.includes('fetch(`${API_URL}/auth/ganti-password`'), "Halaman ganti password harus memanggil endpoint backend yang benar.");
assert(dashboardKaryawan.includes('navigate("/ganti-password")'), "Dashboard karyawan harus menyediakan akses ganti password.");

// Forgotten-password recovery belongs to the employee through a single-use email link.
assert(controller.includes("async function mintaResetPassword(req, res)"), "Endpoint permintaan pemulihan password harus tersedia.");
assert(controller.includes("async function resetPasswordDenganToken(req, res)"), "Endpoint simpan password baru dengan token harus tersedia.");
assert(controller.includes("prisma.permintaanResetPassword.findFirst"), "Permintaan Lupa Password harus dicatat agar dapat dilihat Admin.");
assert(controller.includes("kirimPushKeSemuaAdmin"), "Permintaan Lupa Password harus mengirim notifikasi ke perangkat Admin jika Web Push tersedia.");
assert(controller.includes('title: "Zaman Teknindo — Permintaan Lupa Password"'), "Notifikasi Admin harus mengidentifikasi permintaan Lupa Password.");
assert(recoveryAdminController.includes("async function daftarPermintaanResetPassword"), "Admin harus memiliki endpoint daftar permintaan pemulihan.");
assert(recoveryAdminController.includes("async function buatTautanPemulihanAdmin"), "Admin harus dapat menerbitkan tautan pemulihan, bukan membuat password.");
assert(recoveryAdminController.includes('expiresIn: "20m"'), "Tautan yang diterbitkan Admin harus berlaku 20 menit.");
assert(recoveryAdminController.includes("requestId: permintaan.id"), "Token pemulihan Admin harus terikat ke permintaan yang benar.");
assert(recoveryAdminController.includes("tokenJti"), "Tautan lama harus gugur ketika Admin menerbitkan tautan baru.");
assert(adminRoutes.includes('router.get("/permintaan-reset-password", daftarPermintaanResetPassword);'), "Admin harus dapat melihat daftar permintaan.");
assert(adminRoutes.includes('router.post("/permintaan-reset-password/:id/tautan", buatTautanPemulihanAdmin);'), "Endpoint penerbitan tautan harus berada di bawah proteksi Admin.");
assert(adminOperational.includes("resetPasswordPending: jumlahPemulihanPassword"), "Jumlah permintaan aktif harus masuk ke notifikasi Admin.");
assert(adminRecoveryPage.includes("Buat tautan pemulihan"), "Halaman Admin harus menyediakan tindakan penerbitan tautan.");
assert(adminRecoveryPage.includes("Admin tidak mengatur atau mengetahui password baru"), "Admin tidak boleh melihat atau menentukan password baru.");
assert(prismaSchema.includes("model PermintaanResetPassword"), "Schema Prisma harus memiliki tabel permintaan pemulihan.");
assert(prismaSchema.includes('@@map("permintaan_reset_password")'), "Model Prisma harus terhubung ke tabel yang benar.");
assert(controller.includes('expiresIn: "20m"'), "Tautan reset harus berlaku maksimal 20 menit.");
assert(controller.includes('purpose: "password_reset"'), "Token harus memiliki purpose khusus reset password.");
assert(controller.includes('sidikJariPassword(pengguna.kataSandi) !== dataToken.ver'), "Token lama harus gugur setelah password berubah.");
assert(controller.includes('await prisma.pengguna.updateMany({'), "Reset harus memakai update kondisional agar token sekali pakai.");
assert(controller.includes('if (hasilUpdate.count !== 1)'), "Hanya satu permintaan reset boleh berhasil dengan token yang sama.");
assert(!controller.includes("RESEND_API_KEY"), "Permintaan pemulihan tidak boleh bergantung pada konfigurasi email agar notifikasi Admin tetap berfungsi.");
assert(!controller.includes("buatPasswordSementara"), "Admin tidak boleh membuat password sementara.");

assert(authRoutes.includes('router.post("/lupa-password", batasLupaPassword, mintaResetPassword);'), "Endpoint lupa password harus dibatasi rate limit.");
assert(authRoutes.includes('router.post("/reset-password", batasResetPasswordUser, resetPasswordDenganToken);'), "Endpoint reset token harus dibatasi rate limit.");
assert(rateLimiter.includes("const batasLupaPassword = rateLimit("), "Rate limit permintaan email reset wajib aktif.");
assert(rateLimiter.includes('max: 5,\n  message: { pesan: "Terlalu banyak permintaan pemulihan password.'), "Permintaan email reset maksimal 5 kali per jam per IP.");

assert(login.includes('Lupa password?'), "Halaman login harus menampilkan tautan Lupa Password.");
assert(login.includes('/auth/lupa-password'), "Halaman login harus memanggil API pemulihan.");
assert(login.includes("membuat password baru sendiri"), "Copy harus menjelaskan bahwa pemilik akun membuat password baru sendiri.");
assert(authRoutes.includes('router.get("/lupa-password/status", statusPemulihanPassword);'), "Status kesiapan layanan email harus dapat diperiksa oleh halaman Lupa Password.");
assert(controller.includes("async function statusPemulihanPassword(req, res)"), "Endpoint status pemulihan harus tersedia.");
assert(controller.includes("return res.json({ tersedia });"), "Endpoint status hanya boleh mengembalikan status ketersediaan, bukan kredensial.");
assert(login.includes('new URLSearchParams(location.search).get("mode") === "lupa-password"'), "Mode Lupa Password harus dipulihkan dari URL setelah refresh.");
assert(login.includes('params.set("mode", "lupa-password")'), "Masuk ke mode Lupa Password harus menyimpan status di URL.");
assert(login.includes("Permintaan akan diteruskan ke HR/Admin untuk diverifikasi"), "Form harus menjelaskan permintaan diteruskan kepada Admin.");
assert(login.includes("Kirim Permintaan Pemulihan"), "Karyawan harus dapat mengirim permintaan dari halaman Login.");
assert(login.includes("Setelah identitas diverifikasi"), "Karyawan harus memahami tautan diberikan setelah verifikasi Admin.");
assert(!login.includes("statusEmailPemulihan"), "Form tidak boleh terkunci hanya karena layanan email belum dikonfigurasi.");
assert(login.includes('sessionStorage.setItem(KUNCI_EMAIL_PEMULIHAN_SEMENTARA'), "Email yang diuji harus tetap terisi ketika halaman di-refresh.");
assert(resetPasswordPage.includes('/auth/reset-password'), "Halaman set password baru harus memanggil endpoint reset token.");
assert(resetPasswordPage.includes('passwordBaru !== konfirmasi'), "Halaman reset harus memeriksa konfirmasi password.");
assert(app.includes('path="/reset-password"'), "Rute halaman reset password harus terdaftar.");
assert(app.includes('./pages/ResetPassword'), "Komponen reset password harus dimuat aplikasi.");
assert(packageJson.scripts["vercel-build"].includes("scripts/test-reset-password.cjs"), "Tes pemulihan password harus berjalan pada build Vercel.");

console.log("Employee self-service password recovery regression test: PASS");

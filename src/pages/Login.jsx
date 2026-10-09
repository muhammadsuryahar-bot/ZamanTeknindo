import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  ShieldCheck,
  AlertCircle,
  Info,
  LoaderCircle,
  ArrowRight,
} from "lucide-react";

import { API_URL, simpanSesiLogin } from "../utils/api";
import AuthLayout from "../components/AuthLayout";

const KUNCI_INGAT_SAYA = "zaman-teknindo:ingat-saya";
const KUNCI_EMAIL_TERSIMPAN = "zaman-teknindo:email-login";

function tokenResetDariHash() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.hash.slice(1)).get("resetToken") || "";
}

export default function Login({ onLoginBerhasil, kePendaftaran }) {
  const [email, setEmail] = useState("");
  const [kataSandi, setKataSandi] = useState("");
  const [mode, setMode] = useState(() => tokenResetDariHash() ? "set-password" : "login");
  const [resetToken, setResetToken] = useState(() => tokenResetDariHash());
  const [kataSandiBaru, setKataSandiBaru] = useState("");
  const [konfirmasiKataSandiBaru, setKonfirmasiKataSandiBaru] = useState("");
  const [ingatSaya, setIngatSaya] = useState(() => {
    try {
      return localStorage.getItem(KUNCI_INGAT_SAYA) === "1";
    } catch {
      return false;
    }
  });

  const [pesanError, setPesanError] = useState("");
  const [pesanInfo, setPesanInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [lihatPassword, setLihatPassword] = useState(false);
  const [emailFokus, setEmailFokus] = useState(false);
  const [passwordFokus, setPasswordFokus] = useState(false);

  useEffect(() => {
    try {
      // Token berada di URL fragment agar tidak ikut dikirim ke server/log akses.
      if (tokenResetDariHash()) {
        window.history.replaceState(
          window.history.state,
          "",
          window.location.pathname + window.location.search,
        );
      }
      const emailTersimpan = localStorage.getItem(KUNCI_EMAIL_TERSIMPAN);
      if (emailTersimpan) setEmail(emailTersimpan);

      const pesanTitipan = sessionStorage.getItem("pesanSetelahLogout");
      if (pesanTitipan) {
        setPesanInfo(pesanTitipan);
        sessionStorage.removeItem("pesanSetelahLogout");
      }
    } catch (error) {
      console.warn("Storage browser tidak tersedia:", error);
    }
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setPesanError("");
    setPesanInfo("");

    const emailBersih = email.trim().toLowerCase();
    if (!emailBersih) return setPesanError("Email wajib diisi.");
    if (!kataSandi) return setPesanError("Password wajib diisi.");

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailBersih, kataSandi, ingatSaya }),
      });
      const data = await res.json();

      if (!res.ok) {
        const pesan = data?.pesan || "Email atau password tidak benar.";
        const pesanAkun = /dinonaktifkan|tidak aktif|menunggu/i.test(pesan);
        pesanAkun ? setPesanInfo(pesan) : setPesanError(pesan);
        return;
      }

      try {
        localStorage.setItem(KUNCI_INGAT_SAYA, ingatSaya ? "1" : "0");
        if (ingatSaya) {
          localStorage.setItem(KUNCI_EMAIL_TERSIMPAN, emailBersih);
        } else {
          localStorage.removeItem(KUNCI_EMAIL_TERSIMPAN);
        }
      } catch (storageError) {
        console.warn("Preferensi login tidak dapat disimpan:", storageError);
      }

      simpanSesiLogin(data.token, data.pengguna);
      onLoginBerhasil(data.pengguna);
    } catch (error) {
      console.error("Login error:", error);
      setPesanError("Tidak bisa terhubung ke server. Coba lagi sebentar.");
    } finally {
      setLoading(false);
    }
  }


  async function handleMintaResetPassword(e) {
    e.preventDefault();
    setPesanError("");
    setPesanInfo("");

    const emailBersih = email.trim().toLowerCase();
    if (!emailBersih) {
      setPesanError("Email akun wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API_URL + "/auth/lupa-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailBersih }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.pesan || "Permintaan reset password belum berhasil.");
      }
      setPesanInfo(
        data?.pesan ||
          "Jika email terdaftar, instruksi reset akan dikirim. Periksa kotak masuk dan spam.",
      );
    } catch (error) {
      setPesanError(error?.message || "Tidak bisa meminta reset password. Coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setPesanError("");
    setPesanInfo("");

    if (!resetToken) {
      setPesanError("Token reset tidak ditemukan. Minta tautan reset baru.");
      return;
    }
    if (kataSandiBaru.length < 8) {
      setPesanError("Password baru minimal 8 karakter.");
      return;
    }
    if (kataSandiBaru !== konfirmasiKataSandiBaru) {
      setPesanError("Konfirmasi password baru belum sama.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API_URL + "/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, passwordBaru: kataSandiBaru }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.pesan || "Password belum berhasil diperbarui.");
      }

      setMode("login");
      setResetToken("");
      setKataSandi("");
      setKataSandiBaru("");
      setKonfirmasiKataSandiBaru("");
      setPesanInfo(data?.pesan || "Password berhasil diperbarui. Silakan login.");
    } catch (error) {
      setPesanError(error?.message || "Password belum berhasil diperbarui. Coba minta tautan baru.");
    } finally {
      setLoading(false);
    }
  }

  function handleKembaliLogin() {
    setMode("login");
    setResetToken("");
    setKataSandiBaru("");
    setKonfirmasiKataSandiBaru("");
    setPesanError("");
    setPesanInfo("");
  }

  function handleSubmit(e) {
    if (mode === "request-reset") return handleMintaResetPassword(e);
    if (mode === "set-password") return handleResetPassword(e);
    return handleLogin(e);
  }

  const infoAdalahPeringatan = Boolean(
    pesanInfo && /dinonaktifkan|tidak aktif|menunggu/i.test(pesanInfo),
  );

  return (
    <AuthLayout
      tagline="Kelola kehadiran karyawan dengan lebih tertib, cepat, dan terintegrasi — di mana pun karyawan bertugas."
      formTitle={mode === "login" ? "Masuk ke Akun" : mode === "request-reset" ? "Lupa Password" : "Buat Password Baru"}
      formSubtitle={mode === "login" ? "Gunakan email dan password akun kamu untuk mengakses sistem absensi." : mode === "request-reset" ? "Masukkan email akun terdaftar untuk meminta tautan reset password." : "Buat password baru yang minimal terdiri dari 8 karakter."}
    >
      <form onSubmit={handleSubmit} noValidate name={mode === "login" ? "login" : "reset-password"} className="login-form">
        {mode !== "set-password" && (
          <div className="field">
            <label htmlFor="email" className="field-label">{mode === "request-reset" ? "Email Akun Terdaftar" : "Email"}</label>
            <div className={emailFokus ? "input-wrap focused" : "input-wrap"}>
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                name="username"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setPesanError(""); setPesanInfo(""); }}
                onFocus={() => setEmailFokus(true)}
                onBlur={() => setEmailFokus(false)}
                placeholder={mode === "request-reset" ? "Email yang digunakan saat login" : "nama@perusahaan.com"}
                className="auth-input auth-input-tanpa-tombol"
                autoComplete="username"
                inputMode="email"
                disabled={loading}
                required
              />
            </div>
          </div>
        )}

        {mode === "login" && (
          <div className="field">
            <label htmlFor="kataSandi" className="field-label">Password</label>
            <div className={passwordFokus ? "input-wrap focused" : "input-wrap"}>
              <LockKeyhole size={18} className="input-icon" />
              <input
                id="kataSandi"
                name="current-password"
                type={lihatPassword ? "text" : "password"}
                value={kataSandi}
                onChange={(e) => { setKataSandi(e.target.value); setPesanError(""); setPesanInfo(""); }}
                onFocus={() => setPasswordFokus(true)}
                onBlur={() => setPasswordFokus(false)}
                placeholder="Masukkan password"
                className="auth-input"
                autoComplete="current-password"
                disabled={loading}
                required
              />
              <button
                type="button"
                className="password-button"
                onClick={() => setLihatPassword((n) => !n)}
                disabled={loading}
                title={lihatPassword ? "Sembunyikan password" : "Tampilkan password"}
                aria-label={lihatPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {lihatPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        )}

        {mode === "set-password" && (
          <>
            <div className="field">
              <label htmlFor="kataSandiBaru" className="field-label">Password Baru</label>
              <div className="input-wrap">
                <LockKeyhole size={18} className="input-icon" />
                <input
                  id="kataSandiBaru"
                  name="new-password"
                  type="password"
                  value={kataSandiBaru}
                  onChange={(e) => { setKataSandiBaru(e.target.value); setPesanError(""); setPesanInfo(""); }}
                  placeholder="Minimal 8 karakter"
                  className="auth-input"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={64}
                  disabled={loading}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="konfirmasiKataSandiBaru" className="field-label">Ulangi Password Baru</label>
              <div className="input-wrap">
                <LockKeyhole size={18} className="input-icon" />
                <input
                  id="konfirmasiKataSandiBaru"
                  name="confirm-password"
                  type="password"
                  value={konfirmasiKataSandiBaru}
                  onChange={(e) => { setKonfirmasiKataSandiBaru(e.target.value); setPesanError(""); setPesanInfo(""); }}
                  placeholder="Masukkan ulang password baru"
                  className="auth-input"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={64}
                  disabled={loading}
                  required
                />
              </div>
            </div>
          </>
        )}

        {mode === "login" && (
          <label className="remember-login">
            <input
              type="checkbox"
              checked={ingatSaya}
              onChange={(e) => setIngatSaya(e.target.checked)}
              disabled={loading}
            />
            <span>Ingat saya di perangkat ini</span>
          </label>
        )}

        {mode === "login" && (
          <div className="auth-reset-link-wrap">
            <button
              type="button"
              className="auth-switch-button"
              onClick={() => { setMode("request-reset"); setPesanError(""); setPesanInfo(""); }}
              disabled={loading}
            >
              Lupa password?
            </button>
          </div>
        )}

        {pesanInfo && (
          <div className={infoAdalahPeringatan ? "message message-warning" : "message message-info"} role="alert">
            {infoAdalahPeringatan ? <AlertCircle size={18} /> : <Info size={18} />}
            <span>{pesanInfo}</span>
          </div>
        )}

        {pesanError && (
          <div className="message message-error" role="alert">
            <AlertCircle size={18} />
            <span>{pesanError}</span>
          </div>
        )}

        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? (
            <>
              <LoaderCircle size={18} className="auth-loading-icon" />
              {mode === "login" ? "Memproses login..." : mode === "request-reset" ? "Meminta tautan..." : "Menyimpan password..."}
            </>
          ) : mode === "request-reset" ? (
            <>
              Kirim Tautan Reset
              <ArrowRight size={18} />
            </>
          ) : mode === "set-password" ? (
            <>
              Simpan Password Baru
              <ArrowRight size={18} />
            </>
          ) : (
            <>
              Masuk
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className="auth-switch-area">
        {mode === "login" ? (
          <>
            Belum punya akun?
            <button type="button" className="auth-switch-button" onClick={kePendaftaran} disabled={loading}>
              Daftar di sini
            </button>
          </>
        ) : (
          <button type="button" className="auth-switch-button" onClick={handleKembaliLogin} disabled={loading}>
            Kembali ke Login
          </button>
        )}
      </div>

      <div className="auth-security-note">
        <ShieldCheck size={13} />
        Akses dilindungi oleh sistem autentikasi perusahaan
      </div>

      <style>{`
        .login-form,
        .login-form * {
          font-family: 'IBM Plex Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .remember-login {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: -4px 0 14px;
          color: #596579;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 500;
          cursor: pointer;
          user-select: none;
        }
        .remember-login input {
          width: 16px;
          height: 16px;
          margin: 0;
          accent-color: #1f8f5f;
          cursor: pointer;
          flex: 0 0 auto;
        }
        .remember-login input:disabled {
          cursor: not-allowed;
        }
        .remember-login span {
          font: inherit;
        }
        .auth-reset-link-wrap {
          display: flex;
          justify-content: flex-end;
          margin: -8px 0 16px;
        }
        .auth-reset-link-wrap .auth-switch-button {
          margin-left: 0;
          padding: 5px 0;
        }
      `}</style>
    </AuthLayout>
  );
}

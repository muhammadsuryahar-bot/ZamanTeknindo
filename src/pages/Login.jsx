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

export default function Login({ onLoginBerhasil, kePendaftaran }) {
  const [email, setEmail] = useState("");
  const [kataSandi, setKataSandi] = useState("");
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

  const infoAdalahPeringatan = Boolean(
    pesanInfo && /dinonaktifkan|tidak aktif|menunggu/i.test(pesanInfo),
  );

  return (
    <AuthLayout
      tagline="Kelola kehadiran karyawan dengan lebih tertib, cepat, dan terintegrasi — di mana pun karyawan bertugas."
      formTitle="Masuk ke Akun"
      formSubtitle="Gunakan email dan password akun kamu untuk mengakses sistem absensi."
    >
      <form onSubmit={handleLogin} noValidate name="login" className="login-form">
        <div className="field">
          <label htmlFor="email" className="field-label">Email</label>
          <div className={`input-wrap ${emailFokus ? "focused" : ""}`}>
            <Mail size={18} className="input-icon" />
            <input
              id="email"
              name="username"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setPesanError(""); }}
              onFocus={() => setEmailFokus(true)}
              onBlur={() => setEmailFokus(false)}
              placeholder="nama@perusahaan.com"
              className="auth-input auth-input-tanpa-tombol"
              autoComplete="username"
              inputMode="email"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="kataSandi" className="field-label">Password</label>
          <div className={`input-wrap ${passwordFokus ? "focused" : ""}`}>
            <LockKeyhole size={18} className="input-icon" />
            <input
              id="kataSandi"
              name="current-password"
              type={lihatPassword ? "text" : "password"}
              value={kataSandi}
              onChange={(e) => { setKataSandi(e.target.value); setPesanError(""); }}
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

        <label className="remember-login">
          <input
            type="checkbox"
            checked={ingatSaya}
            onChange={(e) => setIngatSaya(e.target.checked)}
            disabled={loading}
          />
          <span>Ingat saya di perangkat ini</span>
        </label>

        {pesanInfo && (
          <div className={`message ${infoAdalahPeringatan ? "message-warning" : "message-info"}`} role="alert">
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
              Memproses login...
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
        Belum punya akun?
        <button type="button" className="auth-switch-button" onClick={kePendaftaran} disabled={loading}>
          Daftar di sini
        </button>
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
      `}</style>
    </AuthLayout>
  );
}

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

export default function Login({ onLoginBerhasil, kePendaftaran }) {
  const [email, setEmail] = useState("");
  const [kataSandi, setKataSandi] = useState("");

  const [pesanError, setPesanError] = useState("");
  const [pesanInfo, setPesanInfo] = useState("");

  const [loading, setLoading] = useState(false);
  const [lihatPassword, setLihatPassword] = useState(false);

  const [emailFokus, setEmailFokus] = useState(false);
  const [passwordFokus, setPasswordFokus] = useState(false);

  useEffect(() => {
    const pesanTitipan = sessionStorage.getItem("pesanSetelahLogout");
    if (pesanTitipan) {
      setPesanInfo(pesanTitipan);
      sessionStorage.removeItem("pesanSetelahLogout");
    }
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setPesanError("");
    setPesanInfo("");

    const emailBersih = email.trim();
    if (!emailBersih) return setPesanError("Email wajib diisi.");
    if (!kataSandi) return setPesanError("Password wajib diisi.");

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailBersih, kataSandi }),
      });
      const data = await res.json();

      if (!res.ok) {
        const pesan = data?.pesan || "Email atau password tidak benar.";
        const pesanAkun =
          pesan.toLowerCase().includes("dinonaktifkan") ||
          pesan.toLowerCase().includes("tidak aktif") ||
          pesan.toLowerCase().includes("menunggu");
        pesanAkun ? setPesanInfo(pesan) : setPesanError(pesan);
        return;
      }

      simpanSesiLogin(data.token, data.pengguna);
      onLoginBerhasil(data.pengguna);
    } catch (error) {
      console.error("Login error:", error);
      setPesanError("Tidak bisa terhubung ke server. Pastikan backend sudah berjalan.");
    } finally {
      setLoading(false);
    }
  }

  const infoAdalahPeringatan =
    pesanInfo &&
    (pesanInfo.toLowerCase().includes("dinonaktifkan") ||
      pesanInfo.toLowerCase().includes("tidak aktif") ||
      pesanInfo.toLowerCase().includes("menunggu"));

  return (
    <AuthLayout
      tagline="Kelola kehadiran karyawan dengan lebih tertib, cepat, dan terintegrasi — di mana pun karyawan bertugas."
      formTitle="Masuk ke Akun"
      formSubtitle="Gunakan email dan password akun kamu untuk mengakses sistem absensi."
    >
      <form onSubmit={handleLogin} noValidate>
        <div className="field">
          <label htmlFor="email" className="field-label">Email</label>
          <div className={`input-wrap ${emailFokus ? "focused" : ""}`}>
            <Mail size={18} className="input-icon" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setPesanError(""); }}
              onFocus={() => setEmailFokus(true)}
              onBlur={() => setEmailFokus(false)}
              placeholder="nama@perusahaan.com"
              className="auth-input"
              autoComplete="username"
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
    </AuthLayout>
  );
}

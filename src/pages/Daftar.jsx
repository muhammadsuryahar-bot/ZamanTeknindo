import { useState } from "react";
import {
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  ArrowRight,
} from "lucide-react";

import { API_URL } from "../utils/api";
import AuthLayout from "../components/AuthLayout";

const DOMAIN_PERUSAHAAN = "zmanteknindo.com";

export default function Daftar({ keLogin }) {
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [kataSandi, setKataSandi] = useState("");

  const [pesanError, setPesanError] = useState("");
  const [pesanSukses, setPesanSukses] = useState("");

  const [loading, setLoading] = useState(false);
  const [lihatPassword, setLihatPassword] = useState(false);

  const [namaFokus, setNamaFokus] = useState(false);
  const [emailFokus, setEmailFokus] = useState(false);
  const [passwordFokus, setPasswordFokus] = useState(false);

  function emailKantorValid(nilai) {
    const emailBersih = nilai.trim().toLowerCase();
    const pola = new RegExp(`^[^\\s@]+@${DOMAIN_PERUSAHAAN.replace(".", "\\.")}$`);
    return pola.test(emailBersih);
  }

  async function handleDaftar(e) {
    e.preventDefault();
    setPesanError("");
    setPesanSukses("");

    const emailBersih = email.trim().toLowerCase();

    if (!nama.trim()) return setPesanError("Nama lengkap wajib diisi.");
    if (!emailBersih) return setPesanError("Email kantor wajib diisi.");

    if (!emailKantorValid(emailBersih)) {
      return setPesanError(
        `Gunakan email kantor dengan domain @${DOMAIN_PERUSAHAAN}. Contoh: hrd@${DOMAIN_PERUSAHAAN}.`
      );
    }

    if (kataSandi.length < 6) return setPesanError("Password minimal 6 karakter.");

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/daftar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: nama.trim(), email: emailBersih, kataSandi }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPesanError(data.pesan || "Pendaftaran gagal.");
        return;
      }

      setPesanSukses(
        data.pesan ||
          "Pendaftaran berhasil! Menunggu konfirmasi Admin sebelum bisa login."
      );
      setNama("");
      setEmail("");
      setKataSandi("");
    } catch (err) {
      console.error("Daftar error:", err);
      setPesanError(
        "Tidak bisa terhubung ke server. Pastikan backend sudah berjalan."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      tagline="Satu akun untuk absen, lihat riwayat, dan ajukan izin — kapan saja, di mana saja kamu bertugas."
      formTitle="Buat Akun"
      formSubtitle={`Gunakan email kantor @${DOMAIN_PERUSAHAAN}. Akun akan aktif setelah dikonfirmasi Admin.`}
    >
      <form onSubmit={handleDaftar} noValidate>
        <div className="field">
          <label htmlFor="nama" className="field-label">Nama Lengkap</label>
          <div className={`input-wrap ${namaFokus ? "focused" : ""}`}>
            <User size={18} className="input-icon" />
            <input
              id="nama"
              type="text"
              value={nama}
              onChange={(e) => { setNama(e.target.value); setPesanError(""); }}
              onFocus={() => setNamaFokus(true)}
              onBlur={() => setNamaFokus(false)}
              placeholder="Nama sesuai identitas"
              className="auth-input"
              autoComplete="name"
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="email" className="field-label">Email Kantor</label>
          <div className={`input-wrap ${emailFokus ? "focused" : ""}`}>
            <Mail size={18} className="input-icon" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setPesanError(""); }}
              onFocus={() => setEmailFokus(true)}
              onBlur={() => setEmailFokus(false)}
              placeholder={`nama@${DOMAIN_PERUSAHAAN}`}
              className="auth-input"
              autoComplete="username"
              disabled={loading}
              required
            />
          </div>
          <p style={styles.hintEmail}>
            Hanya email dengan domain <strong>@{DOMAIN_PERUSAHAAN}</strong> yang diperbolehkan.
          </p>
        </div>

        <div className="field">
          <label htmlFor="kataSandi" className="field-label">Buat Password</label>
          <div className={`input-wrap ${passwordFokus ? "focused" : ""}`}>
            <LockKeyhole size={18} className="input-icon" />
            <input
              id="kataSandi"
              type={lihatPassword ? "text" : "password"}
              value={kataSandi}
              onChange={(e) => { setKataSandi(e.target.value); setPesanError(""); }}
              onFocus={() => setPasswordFokus(true)}
              onBlur={() => setPasswordFokus(false)}
              placeholder="Minimal 6 karakter"
              className="auth-input"
              autoComplete="new-password"
              disabled={loading}
              minLength={6}
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

        {pesanSukses && (
          <div className="message message-success" role="alert">
            <CheckCircle2 size={18} />
            <span>{pesanSukses}</span>
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
              Memproses pendaftaran...
            </>
          ) : (
            <>
              Daftar
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <div className="auth-switch-area">
        Sudah punya akun?
        <button type="button" className="auth-switch-button" onClick={keLogin} disabled={loading}>
          Login di sini
        </button>
      </div>

      <div className="auth-security-note">
        <ShieldCheck size={13} />
        Pendaftaran akan ditinjau Admin sebelum akun aktif
      </div>
    </AuthLayout>
  );
}

const styles = {
  hintEmail: {
    margin: "6px 0 0",
    fontSize: 11.5,
    lineHeight: 1.45,
    color: "#7A8494",
  },
};

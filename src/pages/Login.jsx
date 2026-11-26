import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
const KUNCI_EMAIL_PEMULIHAN_SEMENTARA = "zaman-teknindo:email-pemulihan-sementara";

export default function Login({ onLoginBerhasil, kePendaftaran }) {
  const navigate = useNavigate();
  const location = useLocation();
  const modeLupaPassword = new URLSearchParams(location.search).get("mode") === "lupa-password";

  function ubahModeLupaPassword(aktif) {
    const params = new URLSearchParams(location.search);
    if (aktif) params.set("mode", "lupa-password");
    else params.delete("mode");
    const query = params.toString();
    navigate({
      pathname: location.pathname,
      search: query ? `?${query}` : "",
      hash: location.hash,
    }, { replace: true });
  }

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
  const [emailPemulihan, setEmailPemulihan] = useState(() => {
    try {
      return sessionStorage.getItem(KUNCI_EMAIL_PEMULIHAN_SEMENTARA) || "";
    } catch {
      return "";
    }
  });
  const [statusEmailPemulihan, setStatusEmailPemulihan] = useState(null);
  const [memeriksaStatusEmail, setMemeriksaStatusEmail] = useState(false);
  const [loadingPemulihan, setLoadingPemulihan] = useState(false);
  const [pesanPemulihan, setPesanPemulihan] = useState("");
  const [errorPemulihan, setErrorPemulihan] = useState("");

  useEffect(() => {
    try {
      const emailTersimpan = localStorage.getItem(KUNCI_EMAIL_TERSIMPAN);
      if (emailTersimpan) setEmail(emailTersimpan);
      if (!sessionStorage.getItem(KUNCI_EMAIL_PEMULIHAN_SEMENTARA) && emailTersimpan) {
        setEmailPemulihan(emailTersimpan);
      }

      const pesanTitipan = sessionStorage.getItem("pesanSetelahLogout");
      if (pesanTitipan) {
        setPesanInfo(pesanTitipan);
        sessionStorage.removeItem("pesanSetelahLogout");
      }
    } catch (error) {
      console.warn("Storage browser tidak tersedia:", error);
    }
  }, []);

  useEffect(() => {
    if (!modeLupaPassword) {
      setStatusEmailPemulihan(null);
      setMemeriksaStatusEmail(false);
      return undefined;
    }

    let masihAktif = true;
    setMemeriksaStatusEmail(true);
    fetch(`${API_URL}/auth/lupa-password/status`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.pesan || "Status layanan email tidak dapat diperiksa.");
        return data;
      })
      .then((data) => {
        if (masihAktif) setStatusEmailPemulihan(data?.tersedia === true);
      })
      .catch((error) => {
        console.warn("Status layanan email pemulihan tidak dapat diperiksa:", error);
        if (masihAktif) setStatusEmailPemulihan(null);
      })
      .finally(() => {
        if (masihAktif) setMemeriksaStatusEmail(false);
      });

    return () => {
      masihAktif = false;
    };
  }, [modeLupaPassword]);

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
    setPesanPemulihan("");
    setErrorPemulihan("");
    const emailBersih = emailPemulihan.trim().toLowerCase();
    if (!emailBersih) {
      setErrorPemulihan("Email akun wajib diisi.");
      return;
    }

    if (statusEmailPemulihan === false) {
      setErrorPemulihan("Layanan email pemulihan belum aktif. Permintaan belum dikirim. Hubungi HR/IT untuk mengaktifkan layanan email.");
      return;
    }

    setLoadingPemulihan(true);
    try {
      const res = await fetch(`${API_URL}/auth/lupa-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailBersih }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorPemulihan(data?.pesan || "Permintaan pemulihan password gagal.");
        return;
      }
      setPesanPemulihan(data?.pesan || "Periksa email Anda untuk tautan pemulihan password.");
    } catch (error) {
      console.error("Permintaan lupa password gagal:", error);
      setErrorPemulihan("Tidak bisa terhubung ke server. Coba lagi atau hubungi HR/IT jika kamu tidak dapat mengakses email akun.");
    } finally {
      setLoadingPemulihan(false);
    }
  }

  const infoAdalahPeringatan = Boolean(
    pesanInfo && /dinonaktifkan|tidak aktif|menunggu/i.test(pesanInfo),
  );

  return (
    <AuthLayout
      tagline="Kelola kehadiran karyawan dengan lebih tertib, cepat, dan terintegrasi — di mana pun karyawan bertugas."
      formTitle={modeLupaPassword ? "Lupa Password" : "Masuk ke Akun"}
      formSubtitle={modeLupaPassword
        ? "Masukkan email akun yang terdaftar. Tautan pemulihan dikirim ke email tersebut agar kamu dapat membuat password baru sendiri."
        : "Gunakan email dan password akun kamu untuk mengakses sistem absensi."}
    >
      <form onSubmit={modeLupaPassword ? handleMintaResetPassword : handleLogin} noValidate name="login" className="login-form">
        {modeLupaPassword ? (<>
        <div className="field">
          <label htmlFor="emailPemulihan" className="field-label">Email Akun</label>
          <div className="input-wrap">
            <Mail size={18} className="input-icon" />
            <input
              id="emailPemulihan"
              name="email"
              type="email"
              value={emailPemulihan}
              onChange={(e) => {
                setEmailPemulihan(e.target.value);
                setErrorPemulihan("");
                setPesanPemulihan("");
                try {
                  if (e.target.value) sessionStorage.setItem(KUNCI_EMAIL_PEMULIHAN_SEMENTARA, e.target.value);
                  else sessionStorage.removeItem(KUNCI_EMAIL_PEMULIHAN_SEMENTARA);
                } catch { /* Penyimpanan sesi tidak tersedia; lanjutkan tanpa menyimpan email. */ }
              }}
              placeholder="nama@zamanteknindo.com"
              className="auth-input auth-input-tanpa-tombol"
              autoComplete="email"
              inputMode="email"
              disabled={loadingPemulihan}
              required
            />
          </div>
        </div>

        {memeriksaStatusEmail && (
          <div className="message message-info" role="status">
            <Info size={18} />
            <span>Memeriksa kesiapan layanan email pemulihan...</span>
          </div>
        )}
        {statusEmailPemulihan === false && (
          <div className="message message-warning" role="status">
            <AlertCircle size={18} />
            <span>Layanan email pemulihan belum diaktifkan. Permintaan belum dapat dikirim dari halaman ini. Hubungi HR/IT untuk mengaktifkan layanan email. Setelah aktif, tautan pemulihan akan dikirim langsung ke email akun agar karyawan membuat password baru sendiri.</span>
          </div>
        )}
        <p style={{ margin: "2px 0 14px", color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
          {statusEmailPemulihan === false
            ? "Setelah layanan aktif, tautan berlaku 20 menit dan hanya dapat digunakan sekali."
            : "Tautan pemulihan dikirim langsung ke email akun yang terdaftar. Buka tautan tersebut untuk membuat password baru sendiri. Tautan berlaku 20 menit dan hanya dapat digunakan sekali."}
        </p>

        {errorPemulihan && (
          <div className="message message-error" role="alert">
            <AlertCircle size={18} />
            <span>{errorPemulihan}</span>
          </div>
        )}
        {pesanPemulihan && (
          <div className="message message-info" role="status">
            <Info size={18} />
            <span>{pesanPemulihan}</span>
          </div>
        )}

        <button type="submit" className="auth-button" disabled={loadingPemulihan || memeriksaStatusEmail || statusEmailPemulihan === false}>
          {memeriksaStatusEmail ? (
            <>
              <LoaderCircle size={18} className="auth-loading-icon" />
              Memeriksa layanan email...
            </>
          ) : loadingPemulihan ? (
            <>
              <LoaderCircle size={18} className="auth-loading-icon" />
              Mengirim permintaan...
            </>
          ) : (
            <>
              Kirim Permintaan Pemulihan
              <ArrowRight size={18} />
            </>
          )}
        </button>
        <button
          type="button"
          className="auth-switch-button"
          onClick={() => {
            setErrorPemulihan("");
            setPesanPemulihan("");
            setStatusEmailPemulihan(null);
            try { sessionStorage.removeItem(KUNCI_EMAIL_PEMULIHAN_SEMENTARA); } catch { /* Penyimpanan sesi tidak tersedia; lanjutkan tanpa menyimpan email. */ }
            ubahModeLupaPassword(false);
          }}
          disabled={loadingPemulihan}
          style={{ display: "block", width: "100%", marginTop: 14, textAlign: "center" }}
        >
          Kembali ke halaman login
        </button>
        </>) : (<>        <div className="field">
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

        <div style={{ display: "flex", justifyContent: "flex-end", margin: "-4px 0 12px" }}>
          <button
            type="button"
            className="auth-switch-button"
            onClick={() => {
              setEmailPemulihan(email);
              setPesanPemulihan("");
              setErrorPemulihan("");
              try {
                if (email) sessionStorage.setItem(KUNCI_EMAIL_PEMULIHAN_SEMENTARA, email);
              } catch { /* Penyimpanan sesi tidak tersedia; lanjutkan tanpa menyimpan email. */ }
              ubahModeLupaPassword(true);
            }}
            disabled={loading}
            style={{ padding: 0, fontSize: 12.5, fontWeight: 700 }}
          >
            Lupa password?
          </button>
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
        </>)}
      </form>

      {!modeLupaPassword && (
        <div className="auth-switch-area">
          Belum punya akun?
          <button type="button" className="auth-switch-button" onClick={kePendaftaran} disabled={loading}>
            Daftar di sini
          </button>
        </div>
      )}

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

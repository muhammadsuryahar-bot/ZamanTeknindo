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
import { warna, font } from "../styles/theme";
import logo from "../assets/logo.png";

export default function Login({ onLoginBerhasil, kePendaftaran }) {
  const [email, setEmail] = useState("");
  const [kataSandi, setKataSandi] = useState("");

  const [pesanError, setPesanError] = useState("");
  const [pesanInfo, setPesanInfo] = useState("");

  const [loading, setLoading] = useState(false);
  const [lihatPassword, setLihatPassword] = useState(false);

  const [emailFokus, setEmailFokus] = useState(false);
  const [passwordFokus, setPasswordFokus] = useState(false);

  // ==========================================================
  // PESAN SESI
  // ==========================================================

  useEffect(() => {
    const pesanTitipan = sessionStorage.getItem("pesanSetelahLogout");

    if (pesanTitipan) {
      setPesanInfo(pesanTitipan);
      sessionStorage.removeItem("pesanSetelahLogout");
    }
  }, []);

  // ==========================================================
  // LOGIN
  // ==========================================================

  async function handleLogin(e) {
    e.preventDefault();

    setPesanError("");
    setPesanInfo("");

    const emailBersih = email.trim();

    if (!emailBersih) {
      setPesanError("Email wajib diisi.");
      return;
    }

    if (!kataSandi) {
      setPesanError("Password wajib diisi.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailBersih,
          kataSandi,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const pesan = data?.pesan || "Email atau password tidak benar.";

        const pesanAkun =
          pesan.toLowerCase().includes("dinonaktifkan") ||
          pesan.toLowerCase().includes("tidak aktif") ||
          pesan.toLowerCase().includes("menunggu");

        if (pesanAkun) {
          setPesanInfo(pesan);
        } else {
          setPesanError(pesan);
        }

        return;
      }

      simpanSesiLogin(data.token, data.pengguna);

      onLoginBerhasil(data.pengguna);
    } catch (error) {
      console.error("Login error:", error);

      setPesanError(
        "Tidak bisa terhubung ke server. Pastikan backend sudah berjalan.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // STATUS PESAN
  // ==========================================================

  const infoAdalahPeringatan =
    pesanInfo &&
    (pesanInfo.toLowerCase().includes("dinonaktifkan") ||
      pesanInfo.toLowerCase().includes("tidak aktif") ||
      pesanInfo.toLowerCase().includes("menunggu"));

  return (
    <>
      <style>{`
        /* =====================================================
           HALAMAN UTAMA
        ===================================================== */

        .login-page {
          min-height: 100vh;
          width: 100%;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 24px;

          box-sizing: border-box;

          background: ${warna.latar};

          overflow: hidden;

          position: relative;
        }

        .login-page::before {
          content: "";

          position: absolute;

          width: 440px;
          height: 440px;

          border-radius: 50%;

          background: ${warna.aksenLembut};

          top: -270px;
          right: -160px;

          opacity: 0.65;

          pointer-events: none;
        }

        .login-page::after {
          content: "";

          position: absolute;

          width: 340px;
          height: 340px;

          border-radius: 50%;

          background: ${warna.peringatanLembut};

          bottom: -230px;
          left: -160px;

          opacity: 0.45;

          pointer-events: none;
        }

        /* =====================================================
           CARD UTAMA
        ===================================================== */

        .login-card {
          width: 100%;
          max-width: 1120px;

          min-height: 680px;

          display: grid;

          grid-template-columns: 43% 57%;

          background: ${warna.panel};

          border:
            1px solid
            rgba(218, 223, 230, 0.9);

          border-radius: 28px;

          overflow: hidden;

          box-shadow:
            0 2px 6px
              rgba(22, 35, 61, 0.03),
            0 25px 70px
              rgba(22, 35, 61, 0.12);

          position: relative;

          z-index: 1;
        }

        /* =====================================================
           PANEL KIRI - BRAND
        ===================================================== */

        .login-brand {
          position: relative;

          overflow: hidden;

          display: flex;

          flex-direction: column;

          justify-content: space-between;

          padding: 48px;

          color: #fff;

          background:
            radial-gradient(
              circle at 15% 10%,
              rgba(255,255,255,0.08),
              transparent 30%
            ),
            linear-gradient(
              155deg,
              #0B6E45 0%,
              #08402A 100%
            );
        }

        /* =====================================================
           GRID BACKGROUND
        ===================================================== */

        .brand-grid {
          position: absolute;

          inset: 0;

          background-image:
            linear-gradient(
              rgba(255,255,255,0.035) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255,255,255,0.035) 1px,
              transparent 1px
            );

          background-size: 26px 26px;

          opacity: 0.8;

          pointer-events: none;
        }

        /* =====================================================
           LINGKARAN DEKORASI
        ===================================================== */

        .brand-circle-one {
          position: absolute;

          width: 430px;
          height: 430px;

          border-radius: 50%;

          border:
            1px solid
            rgba(255,255,255,0.07);

          top: -250px;
          left: -150px;

          pointer-events: none;
        }

        .brand-circle-two {
          position: absolute;

          width: 520px;
          height: 520px;

          border-radius: 50%;

          border:
            1px solid
            rgba(255,255,255,0.045);

          bottom: -390px;
          right: -250px;

          pointer-events: none;
        }

        .brand-content,
        .brand-footer {
          position: relative;

          z-index: 2;
        }

        /* =====================================================
           LOGO
        ===================================================== */

        .brand-logo-box {
          width: 112px;
          height: 112px;

          border-radius: 26px;

          display: flex;
          align-items: center;
          justify-content: center;

          /*
            Background putih agar logo hijau tetap terlihat
            jelas di atas background hijau.
          */
          background:
            rgba(255,255,255,0.94);

          border:
            1px solid
            rgba(255,255,255,0.55);

          box-shadow:
            0 16px 35px
              rgba(0,0,0,0.14);

          backdrop-filter: blur(8px);

          overflow: hidden;
        }

        .brand-logo {
          width: 86px;
          height: 86px;

          object-fit: contain;
          object-position: center;

          display: block;

          flex-shrink: 0;

          /*
            Menjaga proporsi logo.
          */
          aspect-ratio: 1 / 1;

          /*
            Sedikit diperbesar agar logo tidak terlihat
            terlalu kecil ketika file asset memiliki
            ruang kosong di sekelilingnya.
          */
          transform: scale(1.08);
        }

        /* =====================================================
           LABEL BRAND
        ===================================================== */

        .brand-kicker {
          display: flex;

          align-items: center;

          gap: 8px;

          margin-top: 30px;
          margin-bottom: 15px;

          color:
            rgba(255,255,255,0.80);

          font-family:
            ${font.display};

          font-size: 12px;

          font-weight: 700;

          letter-spacing: 0.105em;

          text-transform: uppercase;
        }

        /* =====================================================
           NAMA PERUSAHAAN
        ===================================================== */

        .brand-title {
          margin: 0;

          max-width: 460px;

          color: #fff;

          font-family:
            ${font.display};

          font-size:
            clamp(34px, 4vw, 44px);

          line-height: 1.08;

          font-weight: 700;

          letter-spacing:
            -0.025em;
        }

        .brand-title span {
          color: #D9F1E4;
        }

        /* =====================================================
           DESKRIPSI
        ===================================================== */

        .brand-description {
          margin-top: 20px;

          max-width: 450px;

          color:
            rgba(255,255,255,0.78);

          font-family:
            ${font.display};

          font-size: 14px;

          line-height: 1.8;
        }

        /* =====================================================
           FOOTER BRAND
        ===================================================== */

        .brand-footer {
          display: inline-flex;

          align-items: center;

          gap: 10px;

          width: fit-content;

          padding:
            10px
            14px;

          border-radius: 999px;

          border:
            1px solid
            rgba(255,255,255,0.11);

          background:
            rgba(255,255,255,0.06);

          color:
            rgba(255,255,255,0.78);

          font-family:
            ${font.display};

          font-size: 12px;
        }

        .brand-dot {
          width: 8px;
          height: 8px;

          border-radius: 50%;

          background: #8ED6AE;

          box-shadow:
            0 0 0 5px
            rgba(142,214,174,0.08);
        }

        /* =====================================================
           PANEL FORM
        ===================================================== */

        .login-form-panel {
          display: flex;

          align-items: center;

          justify-content: center;

          padding:
            60px
            72px;

          background:
            ${warna.panel};
        }

        .login-form-wrap {
          width: 100%;

          max-width: 500px;
        }

        /* =====================================================
           JUDUL FORM
        ===================================================== */

        .login-title {
          margin: 0;

          color:
            ${warna.tinta};

          font-family:
            ${font.display};

          font-size:
            clamp(30px, 3vw, 38px);

          font-weight: 700;

          line-height: 1.15;

          letter-spacing:
            -0.025em;
        }

        .login-subtitle {
          margin:
            12px
            0
            34px;

          color:
            ${warna.tintaLembut};

          font-family:
            ${font.display};

          font-size: 14px;

          line-height: 1.65;
        }

        /* =====================================================
           FIELD
        ===================================================== */

        .field {
          margin-bottom: 20px;
        }

        .field-label {
          display: block;

          margin-bottom: 8px;

          color:
            ${warna.tinta};

          font-family:
            ${font.display};

          font-size: 13px;

          font-weight: 700;
        }

        .input-wrap {
          position: relative;
        }

        .input-icon {
          position: absolute;

          left: 15px;
          top: 50%;

          transform:
            translateY(-50%);

          color:
            ${warna.tintaSamar};

          pointer-events: none;

          transition:
            color 0.15s ease;
        }

        .input-wrap.focused .input-icon {
          color:
            ${warna.aksen};
        }

        .login-input {
          width: 100%;

          min-height: 54px;

          box-sizing: border-box;

          padding:
            0
            48px
            0
            46px;

          border:
            1.5px solid
            ${warna.garis};

          border-radius: 14px;

          background:
            #FBFCFD;

          color:
            ${warna.tinta};

          font-family:
            ${font.display};

          font-size: 14px;

          outline: none;

          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
        }

        .login-input:hover {
          background:
            #FFFFFF;
        }

        .login-input:focus {
          background:
            #FFFFFF;

          border-color:
            ${warna.aksen};

          box-shadow:
            0 0 0 4px
            ${warna.aksenLembut};
        }

        .login-input::placeholder {
          color:
            ${warna.tintaSamar};
        }

        /* =====================================================
           TOGGLE PASSWORD
        ===================================================== */

        .password-button {
          position: absolute;

          right: 9px;
          top: 50%;

          transform:
            translateY(-50%);

          width: 36px;
          height: 36px;

          border: none;

          border-radius: 10px;

          background:
            transparent;

          color:
            ${warna.tintaSamar};

          display: flex;

          align-items: center;

          justify-content: center;

          cursor: pointer;

          transition:
            background 0.15s ease,
            color 0.15s ease;
        }

        .password-button:hover {
          background:
            ${warna.panelAlt};

          color:
            ${warna.aksen};
        }

        /* =====================================================
           PESAN
        ===================================================== */

        .message {
          display: flex;

          align-items: flex-start;

          gap: 10px;

          padding:
            12px
            14px;

          margin:
            3px
            0
            17px;

          border-radius: 13px;

          font-family:
            ${font.display};

          font-size: 13px;

          line-height: 1.55;
        }

        .message-error {
          color:
            ${warna.bahaya};

          background:
            ${warna.bahayaLembut};

          border:
            1px solid
            rgba(192,57,43,0.12);
        }

        .message-warning {
          color:
            #8A5600;

          background:
            ${warna.peringatanLembut};

          border:
            1px solid
            rgba(199,120,0,0.14);
        }

        .message-info {
          color:
            ${warna.aksen};

          background:
            ${warna.aksenLembut};

          border:
            1px solid
            rgba(11,110,69,0.10);
        }

        /* =====================================================
           TOMBOL LOGIN
        ===================================================== */

        .login-button {
          width: 100%;

          min-height: 54px;

          border: none;

          border-radius: 14px;

          background:
            linear-gradient(
              180deg,
              #0B6E45 0%,
              #084F34 100%
            );

          color:
            #fff;

          font-family:
            ${font.display};

          font-size: 14px;

          font-weight: 700;

          display: flex;

          align-items: center;

          justify-content: center;

          gap: 9px;

          cursor: pointer;

          box-shadow:
            0 12px 25px
            rgba(11,110,69,0.20);

          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            filter 0.15s ease;
        }

        .login-button:hover:not(:disabled) {
          transform:
            translateY(-1px);

          box-shadow:
            0 16px 30px
            rgba(11,110,69,0.24);

          filter:
            brightness(1.03);
        }

        .login-button:active:not(:disabled) {
          transform:
            translateY(0);
        }

        .login-button:disabled {
          cursor:
            not-allowed;

          opacity:
            0.72;
        }

        .loading-icon {
          animation:
            login-spin
            0.9s
            linear
            infinite;
        }

        @keyframes login-spin {
          from {
            transform:
              rotate(0deg);
          }

          to {
            transform:
              rotate(360deg);
          }
        }

        /* =====================================================
           DAFTAR
        ===================================================== */

        .register-area {
          margin-top: 24px;

          padding-top: 22px;

          border-top:
            1px solid
            ${warna.garis};

          text-align: center;

          color:
            ${warna.tintaLembut};

          font-family:
            ${font.display};

          font-size: 13px;
        }

        .register-button {
          border: none;

          background:
            transparent;

          padding: 0;

          margin-left: 4px;

          color:
            ${warna.aksen};

          font-family:
            inherit;

          font-size:
            inherit;

          font-weight:
            700;

          cursor:
            pointer;
        }

        .register-button:hover {
          text-decoration:
            underline;
        }

        /* =====================================================
           SECURITY NOTE
        ===================================================== */

        .security-note {
          margin-top: 18px;

          display: flex;

          justify-content: center;

          align-items: center;

          gap: 7px;

          color:
            ${warna.tintaSamar};

          font-family:
            ${font.display};

          font-size: 11px;
        }

        /* =====================================================
           TABLET
        ===================================================== */

        @media (max-width: 900px) {
          .login-card {
            max-width: 760px;

            grid-template-columns:
              1fr;
          }

          .login-brand {
            min-height: 320px;

            padding: 38px;
          }

          .login-form-panel {
            padding:
              44px
              38px;
          }

          .brand-description {
            max-width: 560px;
          }
        }

        /* =====================================================
           MOBILE
        ===================================================== */

        @media (max-width: 600px) {
          .login-page {
            padding: 12px;
          }

          .login-card {
            border-radius: 20px;

            min-height: auto;
          }

          .login-brand {
            min-height: 300px;

            padding:
              26px
              24px;
          }

          .brand-logo-box {
            width: 92px;
            height: 92px;

            border-radius: 22px;
          }

          .brand-logo {
            width: 72px;
            height: 72px;

            transform:
              scale(1.06);
          }

          .brand-kicker {
            margin-top:
              22px;

            margin-bottom:
              12px;

            font-size:
              11px;
          }

          .brand-title {
            font-size:
              30px;

            line-height:
              1.08;
          }

          .brand-description {
            margin-top:
              16px;

            font-size:
              13px;

            line-height:
              1.65;
          }

          .login-form-panel {
            padding:
              32px
              22px
              28px;
          }

          .login-title {
            font-size:
              28px;
          }

          .login-subtitle {
            margin-bottom:
              26px;
          }

          .security-note {
            font-size:
              10px;
          }
        }
      `}</style>

      <div className="login-page">
        <div className="login-card">
          {/* ==================================================
              PANEL BRANDING
          =================================================== */}

          <section className="login-brand">
            <div className="brand-grid" />

            <div className="brand-circle-one" />

            <div className="brand-circle-two" />

            <div className="brand-content">
              <div className="brand-logo-box">
                <img
                  src={logo}
                  alt="Logo PT. Zaman Teknindo"
                  className="brand-logo"
                />
              </div>

              <div className="brand-kicker">
                <ShieldCheck size={15} />
                Sistem Internal Perusahaan
              </div>

              <h2 className="brand-title">
                PT. <span>Zaman Teknindo</span>
              </h2>

              <p className="brand-description">
                Kelola kehadiran karyawan dengan lebih tertib, cepat, dan
                terintegrasi — di mana pun karyawan bertugas.
              </p>
            </div>

            <div className="brand-footer">
              <span className="brand-dot" />
              Sistem Absensi Karyawan
            </div>
          </section>

          {/* ==================================================
              FORM LOGIN
          =================================================== */}

          <section className="login-form-panel">
            <div className="login-form-wrap">
              <h1 className="login-title">Masuk ke Akun</h1>

              <p className="login-subtitle">
                Gunakan email dan password akun kamu untuk mengakses sistem
                absensi.
              </p>

              <form onSubmit={handleLogin} noValidate>
                {/* EMAIL */}

                <div className="field">
                  <label htmlFor="email" className="field-label">
                    Email
                  </label>

                  <div className={`input-wrap ${emailFokus ? "focused" : ""}`}>
                    <Mail size={18} className="input-icon" />

                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);

                        setPesanError("");
                      }}
                      onFocus={() => setEmailFokus(true)}
                      onBlur={() => setEmailFokus(false)}
                      placeholder="nama@perusahaan.com"
                      className="login-input"
                      autoComplete="username"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                {/* PASSWORD */}

                <div className="field">
                  <label htmlFor="kataSandi" className="field-label">
                    Password
                  </label>

                  <div
                    className={`input-wrap ${passwordFokus ? "focused" : ""}`}
                  >
                    <LockKeyhole size={18} className="input-icon" />

                    <input
                      id="kataSandi"
                      type={lihatPassword ? "text" : "password"}
                      value={kataSandi}
                      onChange={(e) => {
                        setKataSandi(e.target.value);

                        setPesanError("");
                      }}
                      onFocus={() => setPasswordFokus(true)}
                      onBlur={() => setPasswordFokus(false)}
                      placeholder="Masukkan password"
                      className="login-input"
                      autoComplete="current-password"
                      disabled={loading}
                      required
                    />

                    <button
                      type="button"
                      className="password-button"
                      onClick={() => setLihatPassword((nilai) => !nilai)}
                      disabled={loading}
                      title={
                        lihatPassword
                          ? "Sembunyikan password"
                          : "Tampilkan password"
                      }
                      aria-label={
                        lihatPassword
                          ? "Sembunyikan password"
                          : "Tampilkan password"
                      }
                    >
                      {lihatPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* PESAN INFO */}

                {pesanInfo && (
                  <div
                    className={`message ${
                      infoAdalahPeringatan ? "message-warning" : "message-info"
                    }`}
                    role="alert"
                  >
                    {infoAdalahPeringatan ? (
                      <AlertCircle size={18} />
                    ) : (
                      <Info size={18} />
                    )}

                    <span>{pesanInfo}</span>
                  </div>
                )}

                {/* PESAN ERROR */}

                {pesanError && (
                  <div className="message message-error" role="alert">
                    <AlertCircle size={18} />

                    <span>{pesanError}</span>
                  </div>
                )}

                {/* BUTTON LOGIN */}

                <button
                  type="submit"
                  className="login-button"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <LoaderCircle size={18} className="loading-icon" />
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

              {/* REGISTER */}

              <div className="register-area">
                Belum punya akun?
                <button
                  type="button"
                  className="register-button"
                  onClick={kePendaftaran}
                  disabled={loading}
                >
                  Daftar di sini
                </button>
              </div>

              {/* SECURITY */}

              <div className="security-note">
                <ShieldCheck size={13} />
                Akses dilindungi oleh sistem autentikasi perusahaan
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

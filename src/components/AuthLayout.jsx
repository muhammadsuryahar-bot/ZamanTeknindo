import { ShieldCheck } from "lucide-react";
import { warna, font } from "../styles/theme";
import logo from "../assets/logo.png";

// ============================================================
// AuthLayout -- kerangka bersama untuk halaman Login & Daftar.
//
// Tahap 1:
// - Membuat layout desktop tetap premium dan tidak berlebihan.
// - Membuat mobile jauh lebih ringkas agar halaman login tidak terasa
//   terlalu panjang.
// - Memperbaiki tombol tampil/sembunyikan password agar terasa seperti
//   kontrol UI yang jelas, bukan icon yang "menempel" ke input.
// - Memperbesar area sentuh kontrol password di perangkat mobile.
// - Menjaga seluruh logika Login/Daftar tetap berada di file masing-masing.
//
// Bagian yang berbeda antara Login dan Daftar tetap dikirim melalui props:
// tagline, formTitle, formSubtitle, dan children.
export default function AuthLayout({
  tagline,
  formTitle,
  formSubtitle,
  children,
}) {
  return (
    <>
      <style>{`
        /* =====================================================
           HALAMAN UTAMA
        ===================================================== */
        .auth-page {
          min-height: 100svh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          box-sizing: border-box;
          background: ${warna.latar};
          overflow-x: hidden;
          overflow-y: hidden;
          position: relative;
        }

        .auth-page::before {
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

        .auth-page::after {
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
        .auth-card {
          width: 100%;
          max-width: 1120px;
          min-height: 640px;
          display: grid;
          grid-template-columns: 43% 57%;
          background: ${warna.panel};
          border: 1px solid rgba(218, 223, 230, 0.9);
          border-radius: 28px;
          overflow: hidden;
          box-shadow:
            0 2px 6px rgba(22, 35, 61, 0.03),
            0 25px 70px rgba(22, 35, 61, 0.12);
          position: relative;
          z-index: 1;
        }

        /* =====================================================
           PANEL KIRI -- BRAND
        ===================================================== */
        .auth-brand {
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 46px;
          color: #fff;
          background:
            radial-gradient(
              circle at 15% 10%,
              rgba(255,255,255,0.08),
              transparent 30%
            ),
            linear-gradient(
              155deg,
              ${warna.aksen} 0%,
              ${warna.aksenGelap} 100%
            );
        }

        .auth-brand-grid {
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

        .auth-brand-circle-one {
          position: absolute;
          width: 430px;
          height: 430px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.07);
          top: -250px;
          left: -150px;
          pointer-events: none;
        }

        .auth-brand-circle-two {
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.045);
          bottom: -390px;
          right: -250px;
          pointer-events: none;
        }

        .auth-brand-content,
        .auth-brand-footer {
          position: relative;
          z-index: 2;
        }

        .auth-brand-logo-box {
          width: 104px;
          height: 104px;
          border-radius: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.95);
          border: 1px solid rgba(255,255,255,0.55);
          box-shadow: 0 16px 35px rgba(0,0,0,0.14);
          backdrop-filter: blur(8px);
          overflow: hidden;
        }

        .auth-brand-logo {
          width: 80px;
          height: 80px;
          object-fit: contain;
          object-position: center;
          display: block;
          flex-shrink: 0;
          aspect-ratio: 1 / 1;
          transform: scale(1.06);
        }

        .auth-brand-kicker {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 28px;
          margin-bottom: 14px;
          color: rgba(255,255,255,0.80);
          font-family: ${font.display};
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.105em;
          text-transform: uppercase;
        }

        .auth-brand-title {
          margin: 0;
          max-width: 460px;
          color: #fff;
          font-family: ${font.display};
          font-size: clamp(34px, 4vw, 44px);
          line-height: 1.08;
          font-weight: 700;
          letter-spacing: -0.025em;
        }

        .auth-brand-title span {
          color: #D9F1E4;
        }

        .auth-brand-description {
          margin-top: 19px;
          max-width: 450px;
          color: rgba(255,255,255,0.78);
          font-family: ${font.display};
          font-size: 14px;
          line-height: 1.8;
        }

        .auth-brand-footer {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.11);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.78);
          font-family: ${font.display};
          font-size: 12px;
        }

        .auth-brand-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #8ED6AE;
          box-shadow: 0 0 0 5px rgba(142,214,174,0.08);
          flex-shrink: 0;
        }

        /* =====================================================
           PANEL FORM
        ===================================================== */
        .auth-form-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 56px 68px;
          background: ${warna.panel};
          overflow-y: auto;
        }

        .auth-form-wrap {
          width: 100%;
          max-width: 500px;
        }

        .auth-title {
          margin: 0;
          color: ${warna.tinta};
          font-family: ${font.display};
          font-size: clamp(30px, 3vw, 38px);
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.025em;
        }

        .auth-subtitle {
          margin: 12px 0 32px;
          color: ${warna.tintaLembut};
          font-family: ${font.display};
          font-size: 14px;
          line-height: 1.65;
        }

        /* =====================================================
           FIELD & INPUT
        ===================================================== */
        .field {
          margin-bottom: 19px;
        }

        .field-label {
          display: block;
          margin-bottom: 8px;
          color: ${warna.tinta};
          font-family: ${font.display};
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
          transform: translateY(-50%);
          color: ${warna.tintaSamar};
          pointer-events: none;
          transition: color 0.15s ease;
          z-index: 2;
        }

        .input-wrap.focused .input-icon {
          color: ${warna.aksen};
        }

        .auth-input {
          width: 100%;
          min-height: 54px;
          box-sizing: border-box;
          padding: 0 54px 0 46px;
          border: 1.5px solid ${warna.garis};
          border-radius: 14px;
          background: #FBFCFD;
          color: ${warna.tinta};
          font-family: ${font.display};
          font-size: 14px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease,
            background 0.15s ease;
        }

        .auth-input:hover {
          background: #FFFFFF;
        }

        .auth-input:focus {
          background: #FFFFFF;
          border-color: ${warna.aksen};
          box-shadow: 0 0 0 4px ${warna.aksenLembut};
        }

        .auth-input::placeholder {
          color: ${warna.tintaSamar};
        }

        .auth-input.no-icon {
          padding-left: 16px;
        }

        /* =====================================================
           PASSWORD VISIBILITY CONTROL
           Dibuat sebagai area kontrol tersendiri supaya lebih
           mudah dipahami dan disentuh, terutama di HP.
        ===================================================== */
        .password-button {
          position: absolute;
          right: 5px;
          top: 50%;
          transform: translateY(-50%);
          width: 42px;
          height: 42px;
          border: none;
          border-left: 1px solid ${warna.garis};
          border-radius: 0 10px 10px 0;
          background: transparent;
          color: ${warna.tintaSamar};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition:
            background 0.15s ease,
            color 0.15s ease,
            border-color 0.15s ease;
          z-index: 3;
        }

        .password-button:hover {
          background: ${warna.panelAlt};
          color: ${warna.aksen};
          border-left-color: ${warna.garis};
        }

        .password-button:focus-visible {
          outline: 2px solid ${warna.aksen};
          outline-offset: -2px;
        }

        .password-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        /* =====================================================
           PESAN
        ===================================================== */
        .message {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          margin: 3px 0 17px;
          border-radius: 13px;
          font-family: ${font.display};
          font-size: 13px;
          line-height: 1.55;
        }

        .message-error {
          color: ${warna.bahaya};
          background: ${warna.bahayaLembut};
          border: 1px solid rgba(192,57,43,0.12);
        }

        .message-warning {
          color: #8A5600;
          background: ${warna.peringatanLembut};
          border: 1px solid rgba(199,120,0,0.14);
        }

        .message-info {
          color: ${warna.aksen};
          background: ${warna.aksenLembut};
          border: 1px solid rgba(11,110,69,0.10);
        }

        .message-success {
          color: ${warna.sukses};
          background: ${warna.suksesLembut};
          border: 1px solid rgba(47,133,90,0.14);
        }

        /* =====================================================
           TOMBOL UTAMA
        ===================================================== */
        .auth-button {
          width: 100%;
          min-height: 54px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(
            180deg,
            ${warna.aksen} 0%,
            #084F34 100%
          );
          color: #fff;
          font-family: ${font.display};
          font-size: 14px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          cursor: pointer;
          box-shadow: 0 12px 25px rgba(11,110,69,0.20);
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            filter 0.15s ease;
        }

        .auth-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 16px 30px rgba(11,110,69,0.24);
          filter: brightness(1.03);
        }

        .auth-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .auth-button:focus-visible {
          outline: 3px solid ${warna.aksenLembut};
          outline-offset: 3px;
        }

        .auth-button:disabled {
          cursor: not-allowed;
          opacity: 0.72;
        }

        .auth-loading-icon {
          animation: auth-spin 0.9s linear infinite;
        }

        @keyframes auth-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        /* =====================================================
           LINK BAWAH & SECURITY NOTE
        ===================================================== */
        .auth-switch-area {
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid ${warna.garis};
          text-align: center;
          color: ${warna.tintaLembut};
          font-family: ${font.display};
          font-size: 13px;
        }

        .auth-switch-button {
          border: none;
          background: transparent;
          padding: 4px 0;
          margin-left: 4px;
          color: ${warna.aksen};
          font-family: inherit;
          font-size: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .auth-switch-button:hover {
          text-decoration: underline;
        }

        .auth-switch-button:focus-visible {
          outline: 2px solid ${warna.aksen};
          outline-offset: 3px;
          border-radius: 4px;
        }

        .auth-switch-button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .auth-security-note {
          margin-top: 16px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 7px;
          color: ${warna.tintaSamar};
          font-family: ${font.display};
          font-size: 11px;
          line-height: 1.4;
          text-align: center;
        }

        /* =====================================================
           TABLET
        ===================================================== */
        @media (max-width: 900px) {
          .auth-page {
            height: auto;
            min-height: 100svh;
            align-items: center;
            padding: 18px;
            overflow-y: hidden;
          }

          .auth-card {
            max-width: 760px;
            grid-template-columns: 1fr;
          }

          .auth-brand {
            min-height: 254px;
            padding: 32px 36px 26px;
          }

          .auth-brand-content {
            display: grid;
            grid-template-columns: auto 1fr;
            column-gap: 24px;
            align-items: center;
          }

          .auth-brand-logo-box {
            grid-row: 1 / span 3;
          }

          .auth-brand-kicker {
            margin-top: 0;
            margin-bottom: 10px;
          }

          .auth-brand-title {
            font-size: 34px;
          }

          .auth-brand-description {
            margin-top: 12px;
            max-width: 560px;
          }

          .auth-brand-footer {
            margin-top: 22px;
          }

          .auth-form-panel {
            padding: 42px 38px;
          }
        }

        /* =====================================================
           MOBILE
        ===================================================== */
        @media (max-width: 600px) {
          .auth-page {
            height: auto;
    min-height: 100svh;
            padding: 8px;
            align-items: center;
            overflow-y: hidden;
          }

          .auth-page::before {
            width: 300px;
            height: 300px;
            top: -190px;
            right: -150px;
          }

          .auth-page::after {
            width: 240px;
            height: 240px;
            bottom: -180px;
            left: -140px;
          }

          .auth-card {
            min-height: auto;
            border-radius: 18px;
            box-shadow:
              0 2px 5px rgba(22, 35, 61, 0.03),
              0 16px 38px rgba(22, 35, 61, 0.11);
          }

          /* Brand mobile sengaja dibuat compact.
             Tujuannya bukan menghilangkan identitas, tetapi mengurangi
             tinggi halaman agar form login cepat terlihat. */
          .auth-brand {
            min-height: auto;
            padding: 20px 20px 18px;
            justify-content: flex-start;
          }

          .auth-brand-grid {
            background-size: 22px 22px;
          }

          .auth-brand-circle-one {
            width: 280px;
            height: 280px;
            top: -190px;
            left: -140px;
          }

          .auth-brand-circle-two {
            width: 320px;
            height: 320px;
            bottom: -250px;
            right: -200px;
          }

          .auth-brand-content {
            display: block;
          }

          .auth-brand-logo-box {
            width: 68px;
            height: 68px;
            border-radius: 18px;
          }

          .auth-brand-logo {
            width: 54px;
            height: 54px;
            transform: scale(1.05);
          }

          .auth-brand-kicker {
            margin-top: 14px;
            margin-bottom: 7px;
            gap: 6px;
            font-size: 9.5px;
            letter-spacing: 0.085em;
          }

          .auth-brand-kicker svg {
            width: 13px;
            height: 13px;
          }

          .auth-brand-title {
            font-size: 24px;
            line-height: 1.08;
          }

          .auth-brand-description {
            margin-top: 9px;
            font-size: 12px;
            line-height: 1.5;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .auth-brand-footer {
            margin-top: 14px;
            padding: 7px 10px;
            gap: 7px;
            font-size: 10px;
          }

          .auth-brand-dot {
            width: 6px;
            height: 6px;
            box-shadow: 0 0 0 4px rgba(142,214,174,0.08);
          }

          .auth-form-panel {
            padding: 26px 18px 22px;
            align-items: flex-start;
          }

          .auth-form-wrap {
            max-width: none;
          }

          .auth-title {
            font-size: 26px;
            line-height: 1.12;
          }

          .auth-subtitle {
            margin: 8px 0 22px;
            font-size: 13px;
            line-height: 1.55;
          }

          .field {
            margin-bottom: 16px;
          }

          .field-label {
            margin-bottom: 7px;
            font-size: 12px;
          }

          .auth-input {
            min-height: 52px;
            padding-left: 44px;
            padding-right: 56px;
            border-radius: 13px;
            font-size: 14px;
          }

          .input-icon {
            left: 14px;
          }

          .password-button {
            right: 4px;
            width: 44px;
            height: 44px;
            border-radius: 0 9px 9px 0;
          }

          .message {
            margin: 2px 0 15px;
            padding: 11px 12px;
            gap: 8px;
            border-radius: 12px;
            font-size: 12px;
          }

          .auth-button {
            min-height: 52px;
            border-radius: 13px;
          }

          .auth-switch-area {
            margin-top: 19px;
            padding-top: 17px;
            font-size: 12px;
            line-height: 1.6;
          }

          .auth-security-note {
            margin-top: 13px;
            font-size: 10px;
          }
        }

        /* =====================================================
           MOBILE SANGAT KECIL / LANDSCAPE PENDEK
        ===================================================== */
        @media (max-width: 600px) and (max-height: 700px) {
          .auth-brand {
            padding-top: 16px;
            padding-bottom: 14px;
          }

          .auth-brand-description {
            -webkit-line-clamp: 1;
          }

          .auth-brand-footer {
            display: none;
          }

          .auth-form-panel {
            padding-top: 22px;
          }

          .auth-subtitle {
            margin-bottom: 18px;
          }

          .auth-switch-area {
            margin-top: 15px;
            padding-top: 14px;
          }

          .auth-security-note {
            margin-top: 10px;
          }
        }
      `}</style>

      <div className="auth-page">
        <div className="auth-card">
          <section className="auth-brand">
            <div className="auth-brand-grid" />
            <div className="auth-brand-circle-one" />
            <div className="auth-brand-circle-two" />

            <div className="auth-brand-content">
              <div className="auth-brand-logo-box">
                <img
                  src={logo}
                  alt="Logo PT. Zaman Teknindo"
                  className="auth-brand-logo"
                />
              </div>

              <div className="auth-brand-kicker">
                <ShieldCheck size={15} />
                Sistem Internal Perusahaan
              </div>

              <h2 className="auth-brand-title">
                PT. <span>Zaman Teknindo</span>
              </h2>

              <p className="auth-brand-description">{tagline}</p>
            </div>

            <div className="auth-brand-footer">
              <span className="auth-brand-dot" />
              Sistem Absensi Karyawan
            </div>
          </section>

          <section className="auth-form-panel">
            <div className="auth-form-wrap">
              <h1 className="auth-title">{formTitle}</h1>
              <p className="auth-subtitle">{formSubtitle}</p>
              {children}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

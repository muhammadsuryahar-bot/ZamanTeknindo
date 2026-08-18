import { ShieldCheck } from "lucide-react";
import { warna, font } from "../styles/theme";
import logo from "../assets/logo.png";

// ============================================================
// AuthLayout -- kerangka bersama untuk halaman Login & Daftar.
//
// Kenapa dipisah jadi komponen sendiri (bukan di-copy-paste ke 2 file):
// panel hijau dekoratif (gradient, pola grid, lingkaran, logo) itu HARUS
// selalu identik di kedua halaman -- Login & Daftar adalah "halaman
// kembar". Kalau CSS-nya di-duplikat manual ke 2 file terpisah, gampang
// kejadian kayak sebelumnya: satu halaman diperbarui, satunya ketinggalan,
// jadinya kerasa "beda produk". Dengan 1 komponen bersama ini, ubah sekali
// otomatis kepakai di keduanya.
//
// Bagian yang BEDA di tiap halaman (judul, subjudul, isi form, dst) tetap
// ditulis masing-masing di Login.jsx / Daftar.jsx lewat prop `children`.
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
          min-height: 680px;
          display: grid;
          grid-template-columns: 43% 57%;
          background: ${warna.panel};
          border: 1px solid rgba(218, 223, 230, 0.9);
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 2px 6px rgba(22, 35, 61, 0.03), 0 25px 70px rgba(22, 35, 61, 0.12);
          position: relative;
          z-index: 1;
        }

        /* =====================================================
           PANEL KIRI -- BRAND (identik di semua halaman auth)
        ===================================================== */
        .auth-brand {
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          color: #fff;
          background:
            radial-gradient(circle at 15% 10%, rgba(255,255,255,0.08), transparent 30%),
            linear-gradient(155deg, ${warna.aksen} 0%, ${warna.aksenGelap} 100%);
        }

        .auth-brand-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
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
          width: 112px;
          height: 112px;
          border-radius: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.94);
          border: 1px solid rgba(255,255,255,0.55);
          box-shadow: 0 16px 35px rgba(0,0,0,0.14);
          backdrop-filter: blur(8px);
          overflow: hidden;
        }

        .auth-brand-logo {
          width: 86px;
          height: 86px;
          object-fit: contain;
          object-position: center;
          display: block;
          flex-shrink: 0;
          aspect-ratio: 1 / 1;
          transform: scale(1.08);
        }

        .auth-brand-kicker {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 30px;
          margin-bottom: 15px;
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

        .auth-brand-title span { color: #D9F1E4; }

        .auth-brand-description {
          margin-top: 20px;
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
        }

        /* =====================================================
           PANEL FORM -- kerangka; ISINYA beda tiap halaman (children)
        ===================================================== */
        .auth-form-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 72px;
          background: ${warna.panel};
          overflow-y: auto;
        }

        .auth-form-wrap { width: 100%; max-width: 500px; }

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
          margin: 12px 0 34px;
          color: ${warna.tintaLembut};
          font-family: ${font.display};
          font-size: 14px;
          line-height: 1.65;
        }

        /* =====================================================
           FIELD & INPUT (dipakai form Login maupun Daftar)
        ===================================================== */
        .field { margin-bottom: 20px; }

        .field-label {
          display: block;
          margin-bottom: 8px;
          color: ${warna.tinta};
          font-family: ${font.display};
          font-size: 13px;
          font-weight: 700;
        }

        .input-wrap { position: relative; }

        .input-icon {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: ${warna.tintaSamar};
          pointer-events: none;
          transition: color 0.15s ease;
        }

        .input-wrap.focused .input-icon { color: ${warna.aksen}; }

        .auth-input {
          width: 100%;
          min-height: 54px;
          box-sizing: border-box;
          padding: 0 48px 0 46px;
          border: 1.5px solid ${warna.garis};
          border-radius: 14px;
          background: #FBFCFD;
          color: ${warna.tinta};
          font-family: ${font.display};
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }

        .auth-input:hover { background: #FFFFFF; }

        .auth-input:focus {
          background: #FFFFFF;
          border-color: ${warna.aksen};
          box-shadow: 0 0 0 4px ${warna.aksenLembut};
        }

        .auth-input::placeholder { color: ${warna.tintaSamar}; }

        .auth-input.no-icon { padding-left: 16px; }

        .password-button {
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 10px;
          background: transparent;
          color: ${warna.tintaSamar};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .password-button:hover { background: ${warna.panelAlt}; color: ${warna.aksen}; }

        /* =====================================================
           PESAN (error / info / warning / sukses)
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

        .message-error { color: ${warna.bahaya}; background: ${warna.bahayaLembut}; border: 1px solid rgba(192,57,43,0.12); }
        .message-warning { color: #8A5600; background: ${warna.peringatanLembut}; border: 1px solid rgba(199,120,0,0.14); }
        .message-info { color: ${warna.aksen}; background: ${warna.aksenLembut}; border: 1px solid rgba(11,110,69,0.10); }
        .message-success { color: ${warna.sukses}; background: ${warna.suksesLembut}; border: 1px solid rgba(47,133,90,0.14); }

        /* =====================================================
           TOMBOL UTAMA (submit)
        ===================================================== */
        .auth-button {
          width: 100%;
          min-height: 54px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(180deg, ${warna.aksen} 0%, #084F34 100%);
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
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }

        .auth-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 16px 30px rgba(11,110,69,0.24);
          filter: brightness(1.03);
        }

        .auth-button:active:not(:disabled) { transform: translateY(0); }
        .auth-button:disabled { cursor: not-allowed; opacity: 0.72; }

        .auth-loading-icon { animation: auth-spin 0.9s linear infinite; }

        @keyframes auth-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* =====================================================
           LINK BAWAH (ganti halaman) & SECURITY NOTE
        ===================================================== */
        .auth-switch-area {
          margin-top: 24px;
          padding-top: 22px;
          border-top: 1px solid ${warna.garis};
          text-align: center;
          color: ${warna.tintaLembut};
          font-family: ${font.display};
          font-size: 13px;
        }

        .auth-switch-button {
          border: none;
          background: transparent;
          padding: 0;
          margin-left: 4px;
          color: ${warna.aksen};
          font-family: inherit;
          font-size: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .auth-switch-button:hover { text-decoration: underline; }

        .auth-security-note {
          margin-top: 18px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 7px;
          color: ${warna.tintaSamar};
          font-family: ${font.display};
          font-size: 11px;
        }

        /* =====================================================
           TABLET
        ===================================================== */
        @media (max-width: 900px) {
          .auth-card { max-width: 760px; grid-template-columns: 1fr; }
          .auth-brand { min-height: 320px; padding: 38px; }
          .auth-form-panel { padding: 44px 38px; }
          .auth-brand-description { max-width: 560px; }
        }

        /* =====================================================
           MOBILE
        ===================================================== */
        @media (max-width: 600px) {
          .auth-page { padding: 12px; }
          .auth-card { border-radius: 20px; min-height: auto; }
          .auth-brand { min-height: 300px; padding: 26px 24px; }
          .auth-brand-logo-box { width: 92px; height: 92px; border-radius: 22px; }
          .auth-brand-logo { width: 72px; height: 72px; transform: scale(1.06); }
          .auth-brand-kicker { margin-top: 22px; margin-bottom: 12px; font-size: 11px; }
          .auth-brand-title { font-size: 30px; line-height: 1.08; }
          .auth-brand-description { margin-top: 16px; font-size: 13px; line-height: 1.65; }
          .auth-form-panel { padding: 32px 22px 28px; }
          .auth-title { font-size: 28px; }
          .auth-subtitle { margin-bottom: 26px; }
          .auth-security-note { font-size: 10px; }
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
                <img src={logo} alt="Logo PT. Zaman Teknindo" className="auth-brand-logo" />
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

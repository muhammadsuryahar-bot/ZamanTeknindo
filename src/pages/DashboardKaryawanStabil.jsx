import { useEffect } from "react";
import { Camera, CheckCircle2, Clock3, LogOut, MapPin, ShieldCheck } from "lucide-react";
import DashboardKaryawan from "./DashboardKaryawan";
import { warna, font } from "../styles/theme";

// Wrapper ini sengaja tidak lagi melakukan request status kedua.
// DashboardKaryawan sendiri sudah menjadi sumber status absensi, sehingga
// halaman tidak melakukan fetch ganda hanya untuk banner informasi.
export default function DashboardKaryawanStabil(props) {
  // Kelas tipografi konsisten dipasang pada root dokumen halaman karyawan.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--font-karyawan",
      font.display,
    );

    return () => {
      document.documentElement.style.removeProperty("--font-karyawan");
    };
  }, []);

  return (
    <div
      className="dashboard-karyawan-stabil-shell"
      style={{
        width: "100%",
        fontFamily: font.display,
      }}
    >
      <section
        aria-label="Panduan absensi"
        className="panduan-absensi-karyawan"
        style={{
          width: "100%",
          maxWidth: 760,
          margin: "0 auto 12px",
          padding: "14px 16px",
          background: warna.aksenLembut,
          border: `1px solid ${warna.garis}`,
          borderRadius: 18,
          color: warna.tinta,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              borderRadius: 10,
              background: warna.panel,
              border: `1px solid ${warna.garis}`,
              color: warna.aksen,
            }}
          >
            <ShieldCheck size={18} />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: warna.aksen,
              }}
            >
              PANDUAN ABSENSI HARI INI
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 15,
                lineHeight: 1.3,
                fontWeight: 700,
                color: warna.tinta,
              }}
            >
              Ikuti petunjuk yang muncul pada tombol absensi.
            </div>
          </div>
        </div>

        <div
          className="panduan-absensi-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          <div className="panduan-absensi-item">
            <Clock3 size={16} />
            <div>
              <strong>Absen Masuk</strong>
              <span>Tepat waktu sampai <b>08:10 WIB</b>.</span>
            </div>
          </div>

          <div className="panduan-absensi-item">
            <LogOut size={16} />
            <div>
              <strong>Absen Pulang</strong>
              <span>Muncul setelah absen masuk tercatat.</span>
            </div>
          </div>

          <div className="panduan-absensi-item">
            <MapPin size={16} />
            <div>
              <strong>Lokasi</strong>
              <span>Pastikan GPS dan izin lokasi aktif.</span>
            </div>
          </div>
        </div>

        <div
          className="panduan-absensi-note"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 7,
            marginTop: 9,
            fontSize: 12,
            lineHeight: 1.45,
            color: warna.tintaLembut,
          }}
        >
          <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Mulai <b>08:11 WIB</b>, sistem mencatat kehadiran sebagai
            <b> Telat</b>. Absen yang dilakukan di luar homebase tetap dapat
            dicatat dan jaraknya akan terlihat oleh Admin.
          </span>
        </div>
      </section>

      <DashboardKaryawan {...props} />

      <style>{`
        .panduan-absensi-item {
          min-width: 0;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 10px;
          border-radius: 12px;
          background: rgba(255,255,255,0.72);
          border: 1px solid ${warna.garis};
          color: ${warna.aksen};
        }

        .panduan-absensi-item > div {
          min-width: 0;
        }

        .panduan-absensi-item strong {
          display: block;
          font-size: 12px;
          line-height: 1.3;
          color: ${warna.tinta};
        }

        .panduan-absensi-item span {
          display: block;
          margin-top: 2px;
          font-size: 11px;
          line-height: 1.4;
          color: ${warna.tintaLembut};
        }

        @media (max-width: 620px) {
          .panduan-absensi-grid {
            grid-template-columns: 1fr !important;
          }

          .panduan-absensi-karyawan {
            padding: 13px !important;
          }

          .panduan-absensi-item {
            min-height: 54px;
          }

          .panduan-absensi-item strong {
            font-size: 13px;
          }

          .panduan-absensi-item span,
          .panduan-absensi-note {
            font-size: 12px !important;
          }
        }
      `}</style>
    </div>
  );
}

import { CheckCircle2, Clock3, LogOut, MapPin, ShieldCheck } from "lucide-react";
import DashboardKaryawan from "./DashboardKaryawan";
import { warna, font } from "../styles/theme";

// Wrapper ini sengaja tidak melakukan request API tambahan dan tidak mengubah
// API kamera/GPS browser. DashboardKaryawan menjadi satu-satunya sumber status,
// sehingga tidak ada fetch ganda atau monkey-patch yang dapat memicu layar putih.
export default function DashboardKaryawanStabil(props) {
  return (
    <div
      className="dashboard-karyawan-stabil-shell"
      style={{ width: "100%", fontFamily: font.display }}
    >
      <section
        aria-label="Panduan absensi"
        className="panduan-absensi-karyawan"
        style={{
          width: "100%",
          maxWidth: 760,
          margin: "0 auto 12px",
          padding: "16px",
          background: `linear-gradient(145deg, ${warna.aksenLembut}, ${warna.panel})`,
          border: `1px solid ${warna.garis}`,
          borderRadius: 18,
          color: warna.tinta,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 42,
              height: 42,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              borderRadius: 12,
              background: warna.aksen,
              color: "#fff",
            }}
          >
            <ShieldCheck size={21} />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: warna.aksen,
              }}
            >
              PANDUAN ABSENSI HARI INI
            </div>
            <div style={{ marginTop: 2, fontSize: 17, lineHeight: 1.25, fontWeight: 750 }}>
              Lihat petunjuk sebelum menekan tombol absensi.
            </div>
          </div>
        </div>

        <div
          className="panduan-absensi-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 9 }}
        >
          <div className="panduan-absensi-item">
            <Clock3 size={19} />
            <div>
              <strong>ABSEN MASUK</strong>
              <span>Tepat waktu sampai <b>08:10 WIB</b>.</span>
              <small>Mulai 08:11 WIB = Telat.</small>
            </div>
          </div>
          <div className="panduan-absensi-item">
            <LogOut size={19} />
            <div>
              <strong>ABSEN PULANG</strong>
              <span>Muncul setelah absen masuk tercatat.</span>
              <small>Pastikan foto dan lokasi terbaca.</small>
            </div>
          </div>
          <div className="panduan-absensi-item">
            <MapPin size={19} />
            <div>
              <strong>LOKASI</strong>
              <span>Aktifkan GPS dan izin lokasi.</span>
              <small>Jarak dari Homebase dicatat Admin.</small>
            </div>
          </div>
        </div>

        <div
          className="panduan-absensi-note"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 7,
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${warna.garis}`,
            fontSize: 12,
            lineHeight: 1.5,
            color: warna.tintaLembut,
          }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Absen di luar Homebase <b>tetap dapat dicatat</b>. Admin akan melihat lokasi dan jaraknya dari Homebase untuk pemeriksaan lebih lanjut.
          </span>
        </div>
      </section>

      <DashboardKaryawan {...props} />

      <style>{`
        .panduan-absensi-item {
          min-width: 0;
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 11px;
          border-radius: 12px;
          background: rgba(255,255,255,0.78);
          border: 1px solid ${warna.garis};
          color: ${warna.aksen};
        }
        .panduan-absensi-item > div { min-width: 0; }
        .panduan-absensi-item strong,
        .panduan-absensi-item span,
        .panduan-absensi-item small { display: block; }
        .panduan-absensi-item strong {
          font-size: 12.5px;
          line-height: 1.3;
          color: ${warna.tinta};
        }
        .panduan-absensi-item span {
          margin-top: 2px;
          font-size: 11.5px;
          line-height: 1.45;
          color: ${warna.tintaLembut};
        }
        .panduan-absensi-item small {
          margin-top: 2px;
          font-size: 10.5px;
          line-height: 1.4;
          color: ${warna.tintaSamar};
        }
        @media (max-width: 620px) {
          .panduan-absensi-karyawan { padding: 13px !important; }
          .panduan-absensi-grid { grid-template-columns: 1fr !important; }
          .panduan-absensi-item { min-height: 62px; padding: 12px; }
          .panduan-absensi-item strong { font-size: 13px; }
          .panduan-absensi-item span { font-size: 12px; }
          .panduan-absensi-item small,
          .panduan-absensi-note { font-size: 11px !important; }
        }
      `}</style>
    </div>
  );
}

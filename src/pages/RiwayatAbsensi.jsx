import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import { labelStatusKehadiran } from "../utils/statusKehadiran";
import TopbarHijau from "../components/TopbarHijau";
import { CalendarDays, RefreshCcw, AlertCircle, MapPin, Navigation } from "lucide-react";

const TIMEZONE_WIB = "Asia/Jakarta";

export default function RiwayatAbsensi({ kembali }) {
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pesan, setPesan] = useState("");

  async function muatRiwayat() {
    setLoading(true);
    setPesan("");

    try {
      const res = await fetch(`${API_URL}/absensi/riwayat-saya`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        throw new Error(data?.pesan || "Gagal memuat riwayat absensi.");
      }

      setRiwayat(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setRiwayat([]);
      setPesan(err?.message || "Gagal memuat riwayat. Cek koneksi ke server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void muatRiwayat();
  }, []);

  function formatTanggal(tanggalIso) {
    return new Date(tanggalIso).toLocaleDateString("id-ID", {
      timeZone: TIMEZONE_WIB,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatJam(tanggalIso) {
    if (!tanggalIso) return "–";
    return new Date(tanggalIso).toLocaleTimeString("id-ID", {
      timeZone: TIMEZONE_WIB,
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function koordinatValid(latitude, longitude) {
    return (
      Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    );
  }

  function alamatTampilan(item) {
    if (item.alamatMasuk) return item.alamatMasuk;

    if (koordinatValid(item.latitudeMasuk, item.longitudeMasuk)) {
      return `GPS tersedia: ${Number(item.latitudeMasuk).toFixed(6)}, ${Number(item.longitudeMasuk).toFixed(6)}`;
    }

    return "Lokasi GPS tidak tersimpan pada data absensi ini.";
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.shell}>
        <TopbarHijau judul="Riwayat Absensi" kembali={kembali} />

        <div style={styles.content}>
          {loading && (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-pulse" style={styles.skeletonCard}>
                  <div style={{ ...styles.skeletonBar, width: "50%", height: 13 }} />
                  <div style={{ ...styles.skeletonBar, width: "35%", height: 11, marginTop: 10 }} />
                  <div style={{ ...styles.skeletonBar, width: "75%", height: 10, marginTop: 9 }} />
                </div>
              ))}
            </>
          )}

          {!loading && pesan && (
            <div style={styles.errorBox} role="alert">
              <AlertCircle size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <strong style={styles.errorTitle}>Riwayat belum dapat dimuat</strong>
                <p style={styles.errorText}>{pesan}</p>
                <button type="button" onClick={() => void muatRiwayat()} style={styles.retryButton}>
                  <RefreshCcw size={14} />
                  Coba Lagi
                </button>
              </div>
            </div>
          )}

          {!loading && !pesan && riwayat.length === 0 && (
            <div style={styles.kosongBox}>
              <CalendarDays size={28} strokeWidth={1.6} style={styles.kosongIkon} />
              <p style={styles.kosongTitle}>Belum ada riwayat absensi</p>
              <p style={styles.kosongText}>
                Riwayat kehadiran kamu akan muncul di sini setelah melakukan absensi.
              </p>
            </div>
          )}

          {!loading && !pesan && riwayat.map((item) => {
            const status = labelStatusKehadiran(item.statusFinal || item.statusOtomatis);
            const punyaKoordinatMasuk = koordinatValid(item.latitudeMasuk, item.longitudeMasuk);
            const punyaKoordinatPulang = koordinatValid(item.latitudePulang, item.longitudePulang);

            return (
              <div key={item.id} style={styles.itemCard} className="kartu-hover">
                <div style={styles.itemHeader}>
                  <strong style={styles.tanggal}>{formatTanggal(item.tanggal)}</strong>
                  <span style={{ ...styles.badge, color: status.warna, background: status.latar }}>
                    {status.teks}
                  </span>
                </div>

                <p style={styles.itemDetail}>
                  Masuk <span style={styles.mono}>{formatJam(item.jamMasuk)}</span>
                  <span style={styles.pemisah}>·</span>
                  Pulang <span style={styles.mono}>{formatJam(item.jamPulang)}</span>
                </p>

                <div style={styles.locationBlock}>
                  <div style={styles.locationTitle}>
                    <MapPin size={14} />
                    <strong>Lokasi masuk</strong>
                  </div>
                  <p style={styles.itemAlamat}>{alamatTampilan(item)}</p>

                  {punyaKoordinatMasuk && (
                    <a
                      href={`https://www.google.com/maps?q=${item.latitudeMasuk},${item.longitudeMasuk}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.mapsLink}
                    >
                      <Navigation size={13} />
                      Lihat di Google Maps
                    </a>
                  )}
                </div>

                {item.alamatPulang || punyaKoordinatPulang ? (
                  <div style={styles.locationBlock}>
                    <div style={styles.locationTitle}>
                      <MapPin size={14} />
                      <strong>Lokasi pulang</strong>
                    </div>
                    <p style={styles.itemAlamat}>
                      {item.alamatPulang || `GPS tersedia: ${Number(item.latitudePulang).toFixed(6)}, ${Number(item.longitudePulang).toFixed(6)}`}
                    </p>
                    {punyaKoordinatPulang && (
                      <a
                        href={`https://www.google.com/maps?q=${item.latitudePulang},${item.longitudePulang}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.mapsLink}
                      >
                        <Navigation size={13} />
                        Lihat di Google Maps
                      </a>
                    )}
                  </div>
                ) : null}

                {item.catatanAdmin && (
                  <p style={styles.catatan}>Catatan Admin: {item.catatanAdmin}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: "100svh", background: warna.latar, fontFamily: font.display, padding: 16 },
  shell: { maxWidth: 460, margin: "0 auto" },
  content: {},
  errorBox: {
    display: "flex", gap: 10, alignItems: "flex-start", padding: 14, marginBottom: 12,
    borderRadius: 12, border: `1px solid ${warna.bahayaLembut}`, background: warna.bahayaLembut, color: warna.bahaya,
  },
  errorTitle: { display: "block", fontSize: 13, color: warna.tinta },
  errorText: { margin: "4px 0 10px", fontSize: 12, color: warna.tintaLembut, lineHeight: 1.5 },
  retryButton: {
    display: "inline-flex", alignItems: "center", gap: 6, minHeight: 38, padding: "8px 12px",
    borderRadius: 9, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tinta,
    fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  kosongBox: {
    textAlign: "center", padding: "42px 20px", background: warna.panel, borderRadius: 12,
    border: `1px dashed ${warna.garis}`,
  },
  kosongIkon: { display: "block", marginBottom: 10, marginLeft: "auto", marginRight: "auto", color: warna.tintaSamar },
  kosongTitle: { color: warna.tinta, fontSize: 14, fontWeight: 700, margin: 0 },
  kosongText: { color: warna.tintaSamar, fontSize: 12, lineHeight: 1.55, maxWidth: 300, margin: "6px auto 0" },
  skeletonCard: { background: warna.panel, borderRadius: 12, padding: 16, marginBottom: 9, border: `1px solid ${warna.garis}` },
  skeletonBar: { background: warna.panelAlt, borderRadius: 4 },
  itemCard: {
    background: warna.panel, borderRadius: 12, padding: 16, marginBottom: 9, border: `1px solid ${warna.garis}`,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
  },
  itemHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 7 },
  tanggal: { fontSize: 13.5, color: warna.tinta },
  itemDetail: { fontSize: 12.5, color: warna.tinta, margin: "8px 0 8px" },
  itemAlamat: { fontSize: 11.5, color: warna.tintaSamar, margin: "4px 0", lineHeight: 1.45, wordBreak: "break-word" },
  mono: { fontFamily: font.mono, fontWeight: 600 },
  pemisah: { margin: "0 8px", color: warna.garis },
  locationBlock: {
    marginTop: 8, paddingTop: 9, borderTop: `1px solid ${warna.garis}`,
  },
  locationTitle: {
    display: "flex", alignItems: "center", gap: 6, color: warna.tinta, fontSize: 11.5,
  },
  mapsLink: {
    display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7, color: warna.aksen,
    fontSize: 11, fontWeight: 700, textDecoration: "none",
  },
  catatan: {
    fontSize: 11.5, color: warna.tinta, background: warna.panelAlt, padding: "7px 10px",
    borderRadius: 8, marginTop: 9, borderLeft: `3px solid ${warna.aksen}`, lineHeight: 1.45,
  },
  badge: { fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, whiteSpace: "nowrap" },
};

import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import { labelStatusKehadiran } from "../utils/statusKehadiran";
import TopbarHijau from "../components/TopbarHijau";
import { CalendarDays } from "lucide-react";

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
      const data = await res.json();
      setRiwayat(data.data || []);
    } catch (err) {
      console.error(err);
      setPesan("Gagal memuat riwayat. Cek koneksi ke server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    muatRiwayat();
  }, []);

  function formatTanggal(tanggalIso) {
    return new Date(tanggalIso).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatJam(tanggalIso) {
    if (!tanggalIso) return "–";
    return new Date(tanggalIso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
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
                </div>
              ))}
            </>
          )}

          {pesan && <p style={styles.info}>{pesan}</p>}

          {!loading && riwayat.length === 0 && !pesan && (
            <div style={styles.kosongBox}>
              <CalendarDays size={26} strokeWidth={1.6} style={styles.kosongIkon} />
              <p style={styles.info}>Belum ada riwayat absensi.</p>
            </div>
          )}

          {!loading &&
            riwayat.map((item) => {
              const status = labelStatusKehadiran(item.statusFinal || item.statusOtomatis);
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
                  {item.alamatMasuk && <p style={styles.itemAlamat}>{item.alamatMasuk}</p>}
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
  info: { textAlign: "center", color: warna.tintaSamar, padding: 8, fontSize: 13.5, margin: 0 },
  kosongBox: {
    textAlign: "center",
    padding: "40px 20px",
    background: warna.panel,
    borderRadius: 10,
    border: `1px dashed ${warna.garis}`,
  },
  kosongIkon: { display: "block", marginBottom: 8, marginLeft: "auto", marginRight: "auto", color: warna.tintaSamar },
  skeletonCard: { background: warna.panel, borderRadius: 10, padding: 16, marginBottom: 8, border: `1px solid ${warna.garis}` },
  skeletonBar: { background: warna.panelAlt, borderRadius: 4 },
  itemCard: {
    background: warna.panel,
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
    border: `1px solid ${warna.garis}`,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
  },
  itemHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 },
  tanggal: { fontSize: 13.5, color: warna.tinta },
  itemDetail: { fontSize: 12.5, color: warna.tinta, margin: "8px 0 2px 0" },
  itemAlamat: { fontSize: 11.5, color: warna.tintaSamar, margin: "3px 0" },
  mono: { fontFamily: font.mono, fontWeight: 600 },
  pemisah: { margin: "0 8px", color: warna.garis },
  catatan: {
    fontSize: 11.5,
    color: warna.tinta,
    background: warna.panelAlt,
    padding: "6px 10px",
    borderRadius: 8,
    marginTop: 8,
    borderLeft: `3px solid ${warna.aksen}`,
  },
  badge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6 },
};

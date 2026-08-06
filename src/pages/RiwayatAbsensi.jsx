import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import { labelStatusKehadiran } from "../utils/statusKehadiran";
import logo from "../assets/logo.png";

export default function RiwayatAbsensi({ kembali }) {
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    muatRiwayat();
  }, []);

  async function muatRiwayat() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/absensi/riwayat-saya`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setRiwayat(data.data || []);
    } catch (err) {
      setPesan("Gagal memuat riwayat. Cek koneksi ke server.");
    } finally {
      setLoading(false);
    }
  }

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
      <div style={styles.header}>
        <button onClick={kembali} style={styles.tombolKembali}>← Kembali</button>
        <img src={logo} alt="" style={styles.logoKecil} />
        <h2 style={styles.judul}>Riwayat Absensi</h2>
      </div>

      <div style={styles.content}>
        {loading && <p style={styles.info}>Memuat riwayat…</p>}
        {pesan && <p style={styles.info}>{pesan}</p>}
        {!loading && riwayat.length === 0 && <p style={styles.info}>Belum ada riwayat absensi.</p>}

        {!loading &&
          riwayat.map((item) => {
            const status = labelStatusKehadiran(item.statusFinal || item.statusOtomatis);
            return (
              <div key={item.id} style={styles.itemCard}>
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
  );
}

const styles = {
  wrapper: { minHeight: "100vh", background: warna.latar, fontFamily: font.display, padding: 16 },
  header: { maxWidth: 500, margin: "0 auto 16px auto" },
  tombolKembali: {
    background: "none",
    border: "none",
    color: warna.aksen,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    marginBottom: 14,
  },
  logoKecil: { width: 32, height: 32, marginBottom: 6, display: "block" },
  judul: { margin: 0, fontSize: 20, color: warna.tinta, fontWeight: 700 },
  content: { maxWidth: 500, margin: "0 auto" },
  info: { textAlign: "center", color: warna.tintaSamar, padding: 24, fontSize: 13.5 },
  itemCard: {
    background: warna.panel,
    borderRadius: 3,
    padding: 16,
    marginBottom: 8,
    border: `1px solid ${warna.garis}`,
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
    borderRadius: 3,
    marginTop: 8,
    borderLeft: `3px solid ${warna.aksen}`,
  },
  badge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 3 },
};

import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import logo from "../assets/logo.png";

export default function PengajuanIzin({ kembali }) {
  const [tanggal, setTanggal] = useState("");
  const [jenis, setJenis] = useState("izin");
  const [keterangan, setKeterangan] = useState("");
  const [fotoSurat, setFotoSurat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState("");
  const [riwayat, setRiwayat] = useState([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(true);

  useEffect(() => {
    ambilRiwayat();
  }, []);

  async function ambilRiwayat() {
    setLoadingRiwayat(true);
    try {
      const res = await fetch(`${API_URL}/izin/riwayat-saya`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setRiwayat(data.data || []);
    } catch (err) {
      // gagal ambil riwayat gak perlu blokir form, cukup kosongkan aja
      setRiwayat([]);
    } finally {
      setLoadingRiwayat(false);
    }
  }

  function pilihFoto(e) {
    const file = e.target.files?.[0];
    if (file) setFotoSurat(file);
  }

  async function kirimPengajuan(e) {
    e.preventDefault();
    setPesan("");

    if (!tanggal || !keterangan) {
      setPesan("Tanggal dan keterangan wajib diisi.");
      return;
    }
    if (jenis === "sakit" && !fotoSurat) {
      setPesan("Untuk pengajuan Sakit, foto surat sakit wajib dilampirkan.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("tanggal", tanggal);
    formData.append("jenis", jenis);
    formData.append("keterangan", keterangan);
    if (fotoSurat) formData.append("fotoSurat", fotoSurat);

    try {
      const res = await fetch(`${API_URL}/izin/ajukan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setPesan(data.pesan || "Gagal mengirim pengajuan.");
        setLoading(false);
        return;
      }

      setPesan("Pengajuan berhasil dikirim, menunggu persetujuan Admin.");
      setTanggal("");
      setJenis("izin");
      setKeterangan("");
      setFotoSurat(null);
      ambilRiwayat();
    } catch (err) {
      setPesan("Tidak bisa terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  function labelStatus(status) {
    if (status === "disetujui") return { teks: "Disetujui", warna: warna.sukses, latar: warna.suksesLembut };
    if (status === "ditolak") return { teks: "Ditolak", warna: warna.bahaya, latar: warna.bahayaLembut };
    return { teks: "Menunggu Persetujuan", warna: warna.peringatan, latar: warna.peringatanLembut };
  }

  function labelJenis(jenis) {
    const label = { izin: "Izin", sakit: "Sakit", cuti: "Cuti", urgent: "Urgent" };
    return label[jenis] || jenis;
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <button onClick={kembali} style={styles.tombolKembali}>← Kembali</button>
        <img src={logo} alt="" style={styles.logoKecil} />
        <h2 style={styles.judul}>Pengajuan Izin / Sakit / Cuti</h2>
      </div>

      <div style={styles.content}>
        <div style={styles.card}>
          <form onSubmit={kirimPengajuan}>
            <label style={styles.label}>Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              style={styles.input}
            />

            <label style={styles.label}>Jenis Pengajuan</label>
            <select value={jenis} onChange={(e) => setJenis(e.target.value)} style={styles.input}>
              <option value="izin">Izin</option>
              <option value="sakit">Sakit</option>
              <option value="cuti">Cuti</option>
              <option value="urgent">Urgent</option>
            </select>

            <label style={styles.label}>Keterangan</label>
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Contoh: Demam sejak semalam, perlu istirahat."
              rows={3}
              style={{ ...styles.input, resize: "vertical" }}
            />

            {jenis === "sakit" && (
              <>
                <label style={styles.label}>Foto Surat Sakit (wajib)</label>
                <input type="file" accept="image/*" onChange={pilihFoto} style={styles.input} />
                {fotoSurat && <p style={styles.keterangan}>File terpilih: {fotoSurat.name}</p>}
              </>
            )}

            <button type="submit" style={styles.tombolUtama} disabled={loading}>
              {loading ? "Mengirim…" : "Kirim Pengajuan"}
            </button>
          </form>

          {pesan && <p style={styles.pesanInfo}>{pesan}</p>}
        </div>

        <p style={styles.subjudul}>Riwayat Pengajuan</p>

        {loadingRiwayat && <p style={styles.info}>Memuat riwayat…</p>}
        {!loadingRiwayat && riwayat.length === 0 && (
          <p style={styles.info}>Belum ada pengajuan.</p>
        )}

        {riwayat.map((item) => {
          const status = labelStatus(item.status);
          const tanggalTampil = new Date(item.tanggal).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          return (
            <div key={item.id} style={styles.itemCard}>
              <div style={styles.itemHeader}>
                <strong style={styles.itemNama}>
                  {labelJenis(item.jenis)} — {tanggalTampil}
                </strong>
                <span style={{ ...styles.badge, color: status.warna, background: status.latar }}>
                  {status.teks}
                </span>
              </div>
              <p style={styles.itemDetail}>{item.keterangan}</p>
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
  card: {
    background: warna.panel,
    borderRadius: 3,
    padding: "24px 20px",
    marginBottom: 20,
    border: `1px solid ${warna.garis}`,
  },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4, marginTop: 14, color: warna.tinta },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 3,
    border: `1px solid ${warna.garis}`,
    fontSize: 14,
    fontFamily: "inherit",
    boxSizing: "border-box",
    color: warna.tinta,
    background: warna.panel,
    colorScheme: "light",
  },
  tombolUtama: {
    width: "100%",
    padding: "13px",
    background: warna.aksen,
    color: "#fff",
    border: "none",
    borderRadius: 3,
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 18,
  },
  pesanInfo: {
    marginTop: 16,
    fontSize: 13,
    color: warna.tinta,
    background: warna.panelAlt,
    padding: "10px 12px",
    borderRadius: 3,
    borderLeft: `3px solid ${warna.aksen}`,
  },
  keterangan: { fontSize: 12, color: warna.tintaSamar },
  subjudul: { fontSize: 13, fontWeight: 700, color: warna.tinta, marginBottom: 8, letterSpacing: "0.02em" },
  info: { textAlign: "center", color: warna.tintaSamar, padding: 20, fontSize: 13.5 },
  itemCard: {
    background: warna.panel,
    borderRadius: 3,
    padding: 16,
    marginBottom: 8,
    border: `1px solid ${warna.garis}`,
  },
  itemHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 },
  itemNama: { fontSize: 13.5, color: warna.tinta, fontWeight: 600 },
  itemDetail: { fontSize: 12.5, color: warna.tintaLembut, margin: "8px 0 0 0" },
  badge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 3, whiteSpace: "nowrap" },
  catatan: {
    fontSize: 11.5,
    color: warna.tinta,
    background: warna.panelAlt,
    padding: "6px 10px",
    borderRadius: 3,
    marginTop: 8,
    borderLeft: `3px solid ${warna.aksen}`,
  },
};

import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import TopbarHijau from "../components/TopbarHijau";
import { FileEdit } from "lucide-react";

export default function PengajuanIzin({ kembali }) {
  const [tanggal, setTanggal] = useState("");
  const [jenis, setJenis] = useState("izin");
  const [keterangan, setKeterangan] = useState("");
  const [fotoSurat, setFotoSurat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState("");
  const [pesanTipe, setPesanTipe] = useState("error"); // "error" | "sukses"
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
      console.error(err);
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
      setPesanTipe("error");
      return;
    }
    if (jenis === "sakit" && !fotoSurat) {
      setPesan("Untuk pengajuan Sakit, foto surat sakit wajib dilampirkan.");
      setPesanTipe("error");
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
        setPesanTipe("error");
        setLoading(false);
        return;
      }

      setPesan("Pengajuan berhasil dikirim, menunggu persetujuan Admin.");
      setPesanTipe("sukses");
      setTanggal("");
      setJenis("izin");
      setKeterangan("");
      setFotoSurat(null);
      ambilRiwayat();
    } catch (err) {
      console.error(err);
      setPesan("Tidak bisa terhubung ke server.");
      setPesanTipe("error");
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
      <div style={styles.shell}>
        <TopbarHijau judul="Pengajuan Izin / Sakit / Cuti" kembali={kembali} />

        <div style={styles.content}>
          <div style={styles.card}>
            <div style={styles.bracketTL} />
            <div style={styles.bracketTR} />
            <div style={styles.bracketBL} />
            <div style={styles.bracketBR} />

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

            {pesan && (
              <p style={{ ...styles.pesanInfo, borderLeftColor: pesanTipe === "sukses" ? warna.sukses : warna.bahaya }}>
                {pesan}
              </p>
            )}
          </div>

          <p style={styles.subjudul}>Riwayat Pengajuan</p>

          {loadingRiwayat && <p style={styles.info}>Memuat riwayat…</p>}
          {!loadingRiwayat && riwayat.length === 0 && (
            <div style={styles.kosongBox}>
              <FileEdit size={26} strokeWidth={1.6} style={styles.kosongIkon} />
              <p style={styles.info}>Belum ada pengajuan.</p>
            </div>
          )}

          {riwayat.map((item) => {
            const status = labelStatus(item.status);
            const tanggalTampil = new Date(item.tanggal).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            });
            return (
              <div key={item.id} style={styles.itemCard} className="kartu-hover">
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
    </div>
  );
}

const bracketDasar = { position: "absolute", width: 14, height: 14, borderColor: warna.aksen, borderStyle: "solid", borderWidth: 0 };

const styles = {
  wrapper: { minHeight: "100svh", background: warna.latar, fontFamily: font.display, padding: 16 },
  shell: { maxWidth: 460, margin: "0 auto" },
  content: {},
  card: {
    position: "relative",
    background: warna.panel,
    borderRadius: 10,
    padding: "24px 20px",
    marginBottom: 20,
    border: `1px solid ${warna.garis}`,
    boxShadow: "0 1px 2px rgba(22,35,61,0.04), 0 8px 24px rgba(22,35,61,0.06)",
  },
  bracketTL: { ...bracketDasar, top: 10, left: 10, borderTopWidth: 2, borderLeftWidth: 2 },
  bracketTR: { ...bracketDasar, top: 10, right: 10, borderTopWidth: 2, borderRightWidth: 2 },
  bracketBL: { ...bracketDasar, bottom: 10, left: 10, borderBottomWidth: 2, borderLeftWidth: 2 },
  bracketBR: { ...bracketDasar, bottom: 10, right: 10, borderBottomWidth: 2, borderRightWidth: 2 },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4, marginTop: 14, color: warna.tinta },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
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
    borderRadius: 8,
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
    borderRadius: 8,
    borderLeft: `3px solid ${warna.aksen}`,
  },
  keterangan: { fontSize: 12, color: warna.tintaSamar },
  subjudul: { fontSize: 13, fontWeight: 700, color: warna.tinta, marginBottom: 8, letterSpacing: "0.02em" },
  info: { textAlign: "center", color: warna.tintaSamar, padding: 20, fontSize: 13.5 },
  kosongBox: {
    textAlign: "center", padding: "40px 20px", background: warna.panel,
    borderRadius: 10, border: `1px dashed ${warna.garis}`,
  },
  kosongIkon: { display: "block", marginBottom: 8, marginLeft: "auto", marginRight: "auto", color: warna.tintaSamar },
  itemCard: {
    background: warna.panel,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    border: `1px solid ${warna.garis}`,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
  },
  itemHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 },
  itemNama: { fontSize: 13.5, color: warna.tinta, fontWeight: 600 },
  itemDetail: { fontSize: 12.5, color: warna.tintaLembut, margin: "8px 0 0 0" },
  badge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 8, whiteSpace: "nowrap" },
  catatan: {
    fontSize: 11.5,
    color: warna.tinta,
    background: warna.panelAlt,
    padding: "6px 10px",
    borderRadius: 8,
    marginTop: 8,
    borderLeft: `3px solid ${warna.aksen}`,
  },
};

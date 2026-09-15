import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna } from "../styles/theme";
import { ClipboardList, FileText } from "lucide-react";

export default function AdminIzin() {
  const [daftar, setDaftar] = useState([]);
  const [filterStatus, setFilterStatus] = useState("menunggu");
  const [loading, setLoading] = useState(true);
  const [prosesId, setProsesId] = useState(null);
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    void ambilDaftar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && prosesId === null) {
        void ambilDaftar({ silent: true });
      }
    };
    const id = window.setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, prosesId]);

  async function ambilDaftar({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
      setPesan("");
    }
    try {
      const query = filterStatus ? `?status=${filterStatus}` : "";
      const res = await fetch(`${API_URL}/izin/semua${query}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) {
          setDaftar([]);
          setPesan(data.pesan || "Gagal memuat daftar pengajuan.");
        }
        return;
      }
      setDaftar(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      if (!silent) {
        setDaftar([]);
        setPesan("Gagal memuat daftar pengajuan.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function prosesIzin(id, aksi) {
    setProsesId(id);
    setPesan("");
    try {
      const res = await fetch(`${API_URL}/izin/${id}/${aksi}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPesan(data.pesan || "Gagal memproses pengajuan.");
        return;
      }
      setPesan(data.pesan || "Pengajuan berhasil diproses.");
      setDaftar((lama) => lama.filter((item) => item.id !== id));
    } catch (err) {
      console.error(err);
      setPesan("Tidak bisa terhubung ke server.");
    } finally {
      setProsesId(null);
    }
  }

  function labelJenis(jenis) {
    return ({ izin: "Izin", sakit: "Sakit", cuti: "Cuti", urgent: "Urgent" })[jenis] || jenis;
  }

  function labelStatus(status) {
    if (status === "disetujui") return { teks: "Disetujui", warna: warna.sukses, latar: warna.suksesLembut };
    if (status === "ditolak") return { teks: "Ditolak", warna: warna.bahaya, latar: warna.bahayaLembut };
    return { teks: "Menunggu", warna: warna.peringatan, latar: warna.peringatanLembut };
  }

  const filters = [
    { key: "menunggu", label: "Menunggu" },
    { key: "disetujui", label: "Disetujui" },
    { key: "ditolak", label: "Ditolak" },
    { key: "", label: "Semua" },
  ];

  return (
    <div>
      <div style={styles.filterGroup}>
        {filters.map((f) => (
          <button key={f.key || "semua"} type="button" onClick={() => setFilterStatus(f.key)} style={filterStatus === f.key ? styles.filterAktif : styles.filter}>
            {f.label}
          </button>
        ))}
      </div>

      {pesan && <p style={styles.pesanError}>{pesan}</p>}
      {loading && <p style={styles.kosong}>Memuat…</p>}

      {!loading && daftar.length === 0 && (
        <div style={styles.kosongBox}>
          <ClipboardList size={22} strokeWidth={1.6} style={styles.kosongIkon} />
          <p style={styles.kosong}>Tidak ada pengajuan di kategori ini.</p>
        </div>
      )}

      {!loading && daftar.map((item) => {
        const status = labelStatus(item.status);
        const tanggalTampil = new Date(item.tanggal).toLocaleDateString("id-ID", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
        return (
          <div key={item.id} style={styles.itemCard} className="kartu-hover">
            <div style={styles.itemHeader}>
              <div style={{ minWidth: 0 }}>
                <strong style={styles.itemNama}>{item.pengguna?.nama || "-"}</strong>
                <p style={styles.itemSub}>{item.pengguna?.jabatan || "-"} · {item.pengguna?.divisi || "-"}</p>
              </div>
              <span style={{ ...styles.badge, color: status.warna, background: status.latar }}>{status.teks}</span>
            </div>
            <p style={styles.itemDetail}>{labelJenis(item.jenis)} <span style={styles.pemisah}>·</span> {tanggalTampil}</p>
            <p style={styles.itemKeterangan}>{item.keterangan}</p>
            {item.fotoSuratUrl && (
              <a href={item.fotoSuratUrl} target="_blank" rel="noopener noreferrer" style={styles.linkFoto}>
                <FileText size={14} /> Lihat lampiran surat
              </a>
            )}
            {item.status === "menunggu" && (
              <div style={styles.tombolGroup}>
                <button type="button" onClick={() => prosesIzin(item.id, "setujui")} style={styles.tombolSetujui} disabled={prosesId === item.id}>{prosesId === item.id ? "…" : "Setujui"}</button>
                <button type="button" onClick={() => prosesIzin(item.id, "tolak")} style={styles.tombolTolak} disabled={prosesId === item.id}>{prosesId === item.id ? "…" : "Tolak"}</button>
              </div>
            )}
            {item.catatanAdmin && <p style={styles.catatan}>Catatan: {item.catatanAdmin}</p>}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  filterGroup: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  filter: { minHeight: 38, padding: "8px 14px", background: warna.panel, color: warna.tintaLembut, border: `1px solid ${warna.garis}`, borderRadius: 9, fontSize: 12, fontWeight: 650, cursor: "pointer" },
  filterAktif: { minHeight: 38, padding: "8px 14px", background: warna.aksenLembut, color: warna.aksen, border: `1px solid ${warna.aksen}`, borderRadius: 9, fontSize: 12, fontWeight: 750, cursor: "pointer" },
  kosong: { textAlign: "center", color: warna.tintaSamar, padding: 24, fontSize: 13 },
  kosongBox: { textAlign: "center", padding: "28px 12px", background: warna.panel, border: `1px dashed ${warna.garis}`, borderRadius: 11 },
  kosongIkon: { display: "block", marginBottom: 6, marginLeft: "auto", marginRight: "auto", color: warna.tintaSamar },
  pesanError: { color: warna.bahaya, textAlign: "center", fontSize: 12, marginBottom: 12 },
  itemCard: { background: warna.panel, borderRadius: 11, padding: 16, marginBottom: 10, border: `1px solid ${warna.garis}` },
  itemHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  itemNama: { fontSize: 14, color: warna.tinta },
  itemSub: { fontSize: 11.5, color: warna.tintaLembut, margin: "4px 0 0" },
  itemDetail: { fontSize: 12, color: warna.tinta, margin: "10px 0 3px", fontWeight: 700 },
  itemKeterangan: { fontSize: 12, color: warna.tintaLembut, margin: "3px 0 0", lineHeight: 1.55 },
  pemisah: { color: warna.garis },
  badge: { fontSize: 10.5, fontWeight: 750, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" },
  linkFoto: { display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11.5, color: warna.aksen, textDecoration: "none", fontWeight: 750 },
  tombolGroup: { display: "flex", gap: 8, marginTop: 13 },
  tombolSetujui: { flex: 1, minHeight: 38, padding: "8px 12px", background: warna.aksen, color: "#fff", border: `1px solid ${warna.aksen}`, borderRadius: 9, fontSize: 12, fontWeight: 750, cursor: "pointer" },
  tombolTolak: { flex: 1, minHeight: 38, padding: "8px 12px", background: warna.panel, color: warna.bahaya, border: `1px solid ${warna.bahaya}`, borderRadius: 9, fontSize: 12, fontWeight: 750, cursor: "pointer" },
  catatan: { fontSize: 11.5, color: warna.tinta, background: warna.panelAlt, padding: "8px 10px", borderRadius: 9, marginTop: 9, borderLeft: `3px solid ${warna.aksen}` },
};

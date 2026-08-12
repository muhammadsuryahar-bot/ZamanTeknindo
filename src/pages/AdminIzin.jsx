import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import { ClipboardList } from "lucide-react";

export default function AdminIzin() {
  const [daftar, setDaftar] = useState([]);
  const [filterStatus, setFilterStatus] = useState("menunggu");
  const [loading, setLoading] = useState(true);
  const [prosesId, setProsesId] = useState(null); // id yang lagi diproses, buat disable tombol
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    ambilDaftar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  async function ambilDaftar() {
    setLoading(true);
    try {
      const query = filterStatus ? `?status=${filterStatus}` : "";
      const res = await fetch(`${API_URL}/izin/semua${query}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setDaftar(data.data || []);
    } catch (err) {
      setPesan("Gagal memuat daftar pengajuan.");
    } finally {
      setLoading(false);
    }
  }

  async function prosesIzin(id, aksi) {
    setProsesId(id);
    setPesan("");
    try {
      const res = await fetch(`${API_URL}/izin/${id}/${aksi}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok) {
        setPesan(data.pesan || "Gagal memproses pengajuan.");
        setProsesId(null);
        return;
      }

      setPesan(data.pesan);
      ambilDaftar();
    } catch (err) {
      setPesan("Tidak bisa terhubung ke server.");
    } finally {
      setProsesId(null);
    }
  }

  function labelJenis(jenis) {
    const label = { izin: "Izin", sakit: "Sakit", cuti: "Cuti", urgent: "Urgent" };
    return label[jenis] || jenis;
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
          <button
            key={f.key || "semua"}
            onClick={() => setFilterStatus(f.key)}
            style={filterStatus === f.key ? styles.filterAktif : styles.filter}
          >
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

      {!loading &&
        daftar.map((item) => {
          const status = labelStatus(item.status);
          const tanggalTampil = new Date(item.tanggal).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });

          return (
            <div key={item.id} style={styles.itemCard} className="kartu-hover">
              <div style={styles.itemHeader}>
                <div>
                  <strong style={styles.itemNama}>{item.pengguna?.nama || "-"}</strong>
                  <p style={styles.itemSub}>
                    {item.pengguna?.jabatan || "-"} · {item.pengguna?.divisi || "-"}
                  </p>
                </div>
                <span style={{ ...styles.badge, color: status.warna, background: status.latar }}>
                  {status.teks}
                </span>
              </div>

              <p style={styles.itemDetail}>
                {labelJenis(item.jenis)} <span style={styles.pemisah}>·</span> {tanggalTampil}
              </p>
              <p style={styles.itemKeterangan}>{item.keterangan}</p>

              {item.fotoSurat && (
                <a
                  href={item.fotoSurat.startsWith("/uploads/") ? item.fotoSurat : `/uploads/${item.fotoSurat}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.linkFoto}
                >
                  Lihat foto surat sakit →
                </a>
              )}

              {item.status === "menunggu" && (
                <div style={styles.tombolGroup}>
                  <button
                    onClick={() => prosesIzin(item.id, "setujui")}
                    style={styles.tombolSetujui}
                    disabled={prosesId === item.id}
                  >
                    {prosesId === item.id ? "…" : "Setujui"}
                  </button>
                  <button
                    onClick={() => prosesIzin(item.id, "tolak")}
                    style={styles.tombolTolak}
                    disabled={prosesId === item.id}
                  >
                    {prosesId === item.id ? "…" : "Tolak"}
                  </button>
                </div>
              )}

              {item.catatanAdmin && (
                <p style={styles.catatan}>Catatan: {item.catatanAdmin}</p>
              )}
            </div>
          );
        })}
    </div>
  );
}

const styles = {
  filterGroup: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" },
  filter: {
    padding: "8px 14px",
    background: warna.panel,
    color: warna.tintaLembut,
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 500,
    cursor: "pointer",
  },
  filterAktif: {
    padding: "8px 14px",
    background: warna.tinta,
    color: "#fff",
    border: `1px solid ${warna.tinta}`,
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  kosong: { textAlign: "center", color: warna.tintaSamar, padding: 24, fontSize: 13.5 },
  kosongBox: { textAlign: "center", padding: "24px 12px" },
  kosongIkon: { display: "block", marginBottom: 6, marginLeft: "auto", marginRight: "auto", color: warna.tintaSamar },
  pesanError: { color: warna.bahaya, textAlign: "center", fontSize: 13, marginBottom: 12 },
  itemCard: {
    background: warna.panel,
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
    border: `1px solid ${warna.garis}`,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
  },
  itemHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  itemNama: { fontSize: 14.5, color: warna.tinta },
  itemSub: { fontSize: 12.5, color: warna.tintaLembut, margin: "3px 0 0" },
  itemDetail: { fontSize: 12.5, color: warna.tinta, margin: "10px 0 2px 0", fontWeight: 600 },
  itemKeterangan: { fontSize: 12.5, color: warna.tintaLembut, margin: "2px 0 0" },
  pemisah: { color: warna.garis },
  badge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 10, whiteSpace: "nowrap" },
  linkFoto: {
    display: "inline-block",
    marginTop: 8,
    fontSize: 12,
    color: warna.aksen,
    textDecoration: "none",
    fontWeight: 600,
  },
  tombolGroup: { display: "flex", gap: 8, marginTop: 12 },
  tombolSetujui: {
    flex: 1,
    padding: "8px",
    background: warna.tinta,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  tombolTolak: {
    flex: 1,
    padding: "8px",
    background: "#fff",
    color: warna.bahaya,
    border: `1px solid ${warna.bahaya}`,
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  catatan: {
    fontSize: 11.5,
    color: warna.tinta,
    background: warna.panelAlt,
    padding: "6px 10px",
    borderRadius: 10,
    marginTop: 8,
    borderLeft: `3px solid ${warna.aksen}`,
  },
};

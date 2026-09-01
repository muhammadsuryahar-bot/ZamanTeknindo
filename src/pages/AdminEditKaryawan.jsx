import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Edit3, LoaderCircle, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URL, getToken } from "../utils/api";
import { warna } from "../styles/theme";

export default function AdminEditKaryawan() {
  const navigate = useNavigate();
  const [karyawan, setKaryawan] = useState([]);
  const [cari, setCari] = useState("");
  const [loading, setLoading] = useState(true);
  const [simpanId, setSimpanId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [pesan, setPesan] = useState("");
  const [sukses, setSukses] = useState("");
  const [form, setForm] = useState({ email: "", jabatan: "" });

  useEffect(() => {
    const controller = new AbortController();
    let aktif = true;

    async function muatKaryawan() {
      try {
        const res = await fetch(`${API_URL}/admin/karyawan`, {
          headers: { Authorization: `Bearer ${getToken()}` },
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.pesan || "Gagal memuat karyawan.");
        if (aktif) setKaryawan(Array.isArray(data.data) ? data.data : []);
      } catch (error) {
        if (error?.name !== "AbortError" && aktif) setPesan(error.message || "Tidak bisa terhubung ke server.");
      } finally {
        if (aktif) setLoading(false);
      }
    }

    void muatKaryawan();
    return () => {
      aktif = false;
      controller.abort();
    };
  }, []);

  function mulaiEdit(item) {
    setEditId(item.id);
    setForm({ email: item.email || "", jabatan: item.jabatan || "" });
    setPesan("");
    setSukses("");
  }

  async function simpanEdit(id) {
    const email = form.email.trim().toLowerCase();
    const jabatan = form.jabatan.trim();
    if (!email || !email.includes("@")) return setPesan("Format email belum benar.");
    if (!jabatan) return setPesan("Jabatan wajib diisi.");

    setSimpanId(id);
    setPesan("");
    setSukses("");
    try {
      const res = await fetch(`${API_URL}/admin/karyawan/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ email, jabatan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.pesan || "Gagal menyimpan data karyawan.");
      setKaryawan((lama) => lama.map((item) => item.id === id ? { ...item, email, jabatan } : item));
      setEditId(null);
      setSukses(data.pesan || "Data karyawan berhasil diperbarui.");
    } catch (error) {
      setPesan(error.message || "Tidak bisa terhubung ke server.");
    } finally {
      setSimpanId(null);
    }
  }

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return karyawan;
    return karyawan.filter((item) => `${item.nama} ${item.email} ${item.jabatan || ""} ${item.divisi || ""}`.toLowerCase().includes(q));
  }, [karyawan, cari]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button type="button" onClick={() => navigate("/admin")} style={styles.back}><ArrowLeft size={17} /> Kembali ke Dashboard</button>
        <div><h1 style={styles.title}>Edit Data Karyawan</h1><p style={styles.subtitle}>Perbarui email dan jabatan tanpa mengubah password karyawan.</p></div>
      </div>

      {pesan && <div style={styles.error}><X size={17} /> {pesan}</div>}
      {sukses && <div style={styles.success}><CheckCircle2 size={17} /> {sukses}</div>}

      <div style={styles.toolbar}><Search size={17} color={warna.tintaSamar} /><input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, email, jabatan, atau divisi..." style={styles.search} /></div>

      <div style={styles.card}>
        {loading ? <div style={styles.loading}><LoaderCircle className="spin" size={20} /> Memuat karyawan...</div> : hasil.length === 0 ? <div style={styles.empty}>Tidak ada karyawan yang ditemukan.</div> : (
          <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>Nama</th><th style={styles.th}>Email</th><th style={styles.th}>Jabatan</th><th style={styles.th}>Divisi</th><th style={styles.th}></th></tr></thead><tbody>
            {hasil.map((item) => {
              const sedangEdit = editId === item.id;
              return <tr key={item.id}>
                <td style={styles.td}><strong>{item.nama}</strong></td>
                <td style={styles.td}>{sedangEdit ? <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={styles.input} autoComplete="off" /> : item.email}</td>
                <td style={styles.td}>{sedangEdit ? <input value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} style={styles.input} /> : (item.jabatan || "-")}</td>
                <td style={styles.td}>{item.divisi || "-"}</td>
                <td style={{ ...styles.td, textAlign: "right" }}>{sedangEdit ? <div style={styles.actions}><button type="button" onClick={() => setEditId(null)} style={styles.cancel}>Batal</button><button type="button" disabled={simpanId === item.id} onClick={() => void simpanEdit(item.id)} style={styles.save}>{simpanId === item.id ? "Menyimpan..." : "Simpan"}</button></div> : <button type="button" onClick={() => mulaiEdit(item)} style={styles.edit}><Edit3 size={14} /> Edit</button>}</td>
              </tr>;
            })}
          </tbody></table></div>
        )}
      </div>
      <style>{`.spin{animation:adminEditSpin 1s linear infinite}@keyframes adminEditSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: "100svh", padding: "28px", boxSizing: "border-box", background: warna.latar, color: warna.tinta, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" },
  header: { maxWidth: 1200, margin: "0 auto 22px", display: "grid", gap: 16 },
  back: { width: "fit-content", display: "inline-flex", alignItems: "center", gap: 7, border: 0, background: "transparent", color: warna.tintaLembut, cursor: "pointer", padding: 0, fontSize: 13 },
  title: { margin: 0, fontSize: 25, letterSpacing: "-0.02em" },
  subtitle: { margin: "6px 0 0", color: warna.tintaSamar, fontSize: 13 },
  toolbar: { maxWidth: 1200, margin: "0 auto 14px", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 10 },
  search: { width: "100%", border: 0, outline: 0, background: "transparent", fontSize: 13, color: warna.tinta },
  card: { maxWidth: 1200, margin: "0 auto", background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 14, overflow: "hidden" },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", minWidth: 760, borderCollapse: "collapse" },
  th: { padding: "12px 14px", textAlign: "left", fontSize: 11, color: warna.tintaSamar, background: warna.panelAlt, borderBottom: `1px solid ${warna.garis}` },
  td: { padding: "13px 14px", fontSize: 12.5, borderBottom: `1px solid ${warna.garis}`, verticalAlign: "middle" },
  input: { width: "100%", minWidth: 180, boxSizing: "border-box", padding: "8px 9px", border: `1px solid ${warna.garis}`, borderRadius: 8, outline: 0, color: warna.tinta, background: warna.panel },
  actions: { display: "flex", gap: 6, justifyContent: "flex-end" },
  edit: { display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tinta, borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontSize: 12, fontWeight: 650 },
  cancel: { border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tintaLembut, borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontSize: 12 },
  save: { border: 0, background: warna.aksen, color: "white", borderRadius: 8, padding: "7px 11px", cursor: "pointer", fontSize: 12, fontWeight: 700 },
  loading: { minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: warna.tintaSamar, fontSize: 13 },
  empty: { padding: 50, textAlign: "center", color: warna.tintaSamar, fontSize: 13 },
  error: { maxWidth: 1200, margin: "0 auto 12px", display: "flex", gap: 7, alignItems: "center", padding: "10px 12px", borderRadius: 9, background: warna.bahayaLembut, color: warna.bahaya, fontSize: 12.5 },
  success: { maxWidth: 1200, margin: "0 auto 12px", display: "flex", gap: 7, alignItems: "center", padding: "10px 12px", borderRadius: 9, background: warna.suksesLembut, color: warna.sukses, fontSize: 12.5 },
};

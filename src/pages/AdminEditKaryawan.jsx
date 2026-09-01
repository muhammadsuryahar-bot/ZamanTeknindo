import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Edit3, LoaderCircle, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URL, getToken } from "../utils/api";
import { warna, font, teks, radius, bayangan } from "../styles/theme";

export default function AdminEditKaryawan() {
  const navigate = useNavigate();
  const [karyawan, setKaryawan] = useState([]);
  const [kantor, setKantor] = useState([]);
  const [cari, setCari] = useState("");
  const [loading, setLoading] = useState(true);
  const [simpanId, setSimpanId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [pesan, setPesan] = useState("");
  const [sukses, setSukses] = useState("");
  const [form, setForm] = useState({ email: "", jabatan: "", divisi: "", kantorId: "" });

  useEffect(() => {
    const controller = new AbortController();
    let aktif = true;

    async function muatData() {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${getToken()}` };
        const [resKaryawan, resKantor] = await Promise.all([
          fetch(`${API_URL}/admin/karyawan`, { headers, signal: controller.signal }),
          fetch(`${API_URL}/admin/kantor`, { headers, signal: controller.signal }),
        ]);
        const [dataKaryawan, dataKantor] = await Promise.all([
          resKaryawan.json().catch(() => ({})),
          resKantor.json().catch(() => ({})),
        ]);
        if (!resKaryawan.ok) throw new Error(dataKaryawan?.pesan || "Gagal memuat karyawan.");
        if (!resKantor.ok) throw new Error(dataKantor?.pesan || "Gagal memuat kantor.");
        if (aktif) {
          setKaryawan(Array.isArray(dataKaryawan.data) ? dataKaryawan.data : []);
          setKantor(Array.isArray(dataKantor.data) ? dataKantor.data : []);
        }
      } catch (error) {
        if (error?.name !== "AbortError" && aktif) setPesan(error.message || "Tidak bisa terhubung ke server.");
      } finally {
        if (aktif) setLoading(false);
      }
    }

    void muatData();
    return () => {
      aktif = false;
      controller.abort();
    };
  }, []);

  function mulaiEdit(item) {
    setEditId(item.id);
    setForm({
      email: item.email || "",
      jabatan: item.jabatan || "",
      divisi: item.divisi || "",
      kantorId: item.kantor?.id ? String(item.kantor.id) : "",
    });
    setPesan("");
    setSukses("");
  }

  async function simpanEdit(id) {
    const email = form.email.trim().toLowerCase();
    const jabatan = form.jabatan.trim();
    const divisi = form.divisi.trim();
    const kantorId = form.kantorId.trim();

    if (!email || !email.includes("@")) return setPesan("Format email belum benar.");
    if (!jabatan) return setPesan("Jabatan wajib diisi.");
    if (!kantorId) return setPesan("Kantor kerja wajib dipilih.");

    setSimpanId(id);
    setPesan("");
    setSukses("");
    try {
      const res = await fetch(`${API_URL}/admin/karyawan/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ email, jabatan, divisi, kantorId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.pesan || "Gagal menyimpan data karyawan.");
      const terbaru = data?.data || {};
      setKaryawan((lama) => lama.map((item) => item.id === id ? { ...item, ...terbaru } : item));
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
    return karyawan.filter((item) => `${item.nama} ${item.email} ${item.jabatan || ""} ${item.divisi || ""} ${item.kantor?.namaKantor || ""}`.toLowerCase().includes(q));
  }, [karyawan, cari]);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button type="button" onClick={() => navigate("/admin")} style={styles.back}><ArrowLeft size={17} /> Kembali ke Dashboard</button>
        <div>
          <h1 style={styles.title}>Edit Data Karyawan</h1>
          <p style={styles.subtitle}>Perbarui email, jabatan, divisi, dan kantor kerja tanpa mengubah password karyawan.</p>
        </div>
      </div>

      {pesan && <div style={styles.error}><X size={17} /> {pesan}</div>}
      {sukses && <div style={styles.success}><CheckCircle2 size={17} /> {sukses}</div>}

      <div style={styles.toolbar}><Search size={17} color={warna.tintaSamar} /><input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, email, jabatan, divisi, atau kantor..." style={styles.search} /></div>

      <div style={styles.card}>
        {loading ? <div style={styles.loading}><LoaderCircle className="spin" size={20} /> Memuat karyawan...</div> : hasil.length === 0 ? <div style={styles.empty}>Tidak ada karyawan yang ditemukan.</div> : (
          <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.th}>Nama</th><th style={styles.th}>Email</th><th style={styles.th}>Jabatan</th><th style={styles.th}>Divisi</th><th style={styles.th}>Kantor</th><th style={styles.th}></th></tr></thead><tbody>
            {hasil.map((item) => {
              const sedangEdit = editId === item.id;
              return <tr key={item.id}>
                <td style={styles.td}><strong>{item.nama}</strong></td>
                <td style={styles.td}>{sedangEdit ? <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={styles.input} autoComplete="username" /> : item.email}</td>
                <td style={styles.td}>{sedangEdit ? <input value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} style={styles.input} /> : (item.jabatan || "-")}</td>
                <td style={styles.td}>{sedangEdit ? <input value={form.divisi} onChange={(e) => setForm({ ...form, divisi: e.target.value })} style={styles.input} placeholder="Operasional" /> : (item.divisi || "-")}</td>
                <td style={styles.td}>{sedangEdit ? <select value={form.kantorId} onChange={(e) => setForm({ ...form, kantorId: e.target.value })} style={styles.input}><option value="">Pilih kantor...</option>{kantor.map((k) => <option key={k.id} value={k.id}>{k.namaKantor}</option>)}</select> : (item.kantor?.namaKantor || "Belum ditentukan")}</td>
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
  page: { minHeight: "100svh", padding: "28px", boxSizing: "border-box", background: warna.latar, color: warna.tinta, fontFamily: font.display },
  header: { maxWidth: 1240, margin: "0 auto 20px", display: "grid", gap: 12 },
  back: { width: "fit-content", minHeight: 40, display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${warna.garis}`, borderRadius: radius.sedang, background: warna.panel, color: warna.tintaLembut, boxShadow: "0 1px 2px rgba(22,35,61,0.03)", cursor: "pointer", padding: "8px 12px", fontSize: teks.badan, fontWeight: 600, fontFamily: font.display },
  title: { margin: 0, fontSize: teks.hero, lineHeight: 1.15, letterSpacing: "-0.02em" },
  subtitle: { margin: "6px 0 0", color: warna.tintaSamar, fontSize: teks.badan, lineHeight: 1.5 },
  toolbar: { maxWidth: 1240, margin: "0 auto 14px", display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: radius.sedang },
  search: { width: "100%", border: 0, outline: 0, background: "transparent", fontSize: teks.badan, color: warna.tinta, fontFamily: font.display },
  card: { maxWidth: 1240, margin: "0 auto", background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: radius.besar, overflow: "hidden", boxShadow: bayangan },
  tableWrap: { width: "100%", overflowX: "auto" },
  table: { width: "100%", minWidth: 1040, borderCollapse: "collapse", fontFamily: font.display },
  th: { padding: "12px 14px", textAlign: "left", fontSize: teks.kecil, fontWeight: 700, lineHeight: 1.35, color: warna.tintaSamar, background: warna.panelAlt, borderBottom: `1px solid ${warna.garis}` },
  td: { padding: "13px 14px", fontSize: teks.badan, lineHeight: 1.45, color: warna.tinta, borderBottom: `1px solid ${warna.garis}`, verticalAlign: "middle" },
  input: { width: "100%", minWidth: 150, boxSizing: "border-box", minHeight: 40, padding: "8px 9px", border: `1px solid ${warna.garis}`, borderRadius: radius.kecil, outline: 0, color: warna.tinta, background: warna.panel, fontSize: teks.badan, fontFamily: font.display },
  actions: { display: "flex", gap: 6, justifyContent: "flex-end" },
  edit: { display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tinta, borderRadius: radius.sedang, padding: "8px 11px", cursor: "pointer", fontSize: teks.badan, fontWeight: 600, fontFamily: font.display },
  cancel: { minHeight: 40, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tintaLembut, borderRadius: radius.sedang, padding: "8px 11px", cursor: "pointer", fontSize: teks.badan, fontFamily: font.display },
  save: { minHeight: 40, border: 0, background: warna.aksen, color: "white", borderRadius: radius.sedang, padding: "8px 12px", cursor: "pointer", fontSize: teks.badan, fontWeight: 700, fontFamily: font.display },
  loading: { minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: warna.tintaSamar, fontSize: teks.badan },
  empty: { padding: 56, textAlign: "center", color: warna.tintaSamar, fontSize: teks.badan },
  error: { maxWidth: 1240, margin: "0 auto 12px", display: "flex", gap: 7, alignItems: "center", padding: "10px 12px", borderRadius: radius.sedang, background: warna.bahayaLembut, color: warna.bahaya, fontSize: teks.badan },
  success: { maxWidth: 1240, margin: "0 auto 12px", display: "flex", gap: 7, alignItems: "center", padding: "10px 12px", borderRadius: radius.sedang, background: warna.suksesLembut, color: warna.sukses, fontSize: teks.badan },
};

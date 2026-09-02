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

  const renderInput = (field, extra = {}) => (
    <input
      value={form[field]}
      onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
      style={styles.input}
      {...extra}
    />
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button type="button" onClick={() => navigate("/admin")} style={styles.back}>
          <ArrowLeft size={17} /> Kembali ke Dashboard
        </button>
        <div>
          <h1 style={styles.title}>Edit Data Karyawan</h1>
          <p style={styles.subtitle}>Perbarui email, jabatan, divisi, dan kantor kerja tanpa mengubah password karyawan.</p>
        </div>
      </div>

      {pesan && <div style={styles.error}><X size={17} /> {pesan}</div>}
      {sukses && <div style={styles.success}><CheckCircle2 size={17} /> {sukses}</div>}

      <div style={styles.toolbar}>
        <Search size={17} color={warna.tintaSamar} />
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama, email, jabatan, divisi, atau kantor..."
          style={styles.search}
        />
      </div>

      <div style={styles.card}>
        {loading ? (
          <div style={styles.loading}><LoaderCircle className="spin" size={20} /> Memuat karyawan...</div>
        ) : hasil.length === 0 ? (
          <div style={styles.empty}>Tidak ada karyawan yang ditemukan.</div>
        ) : (
          <>
            <div className="admin-edit-desktop-table">
              <table style={styles.table}>
                <colgroup>
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "10%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={styles.th}>Nama</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Jabatan</th>
                    <th style={styles.th}>Divisi</th>
                    <th style={styles.th}>Kantor</th>
                    <th style={styles.thAksi}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {hasil.map((item) => {
                    const sedangEdit = editId === item.id;
                    return (
                      <tr key={item.id}>
                        <td style={styles.td}><strong style={styles.namaCell}>{item.nama}</strong></td>
                        <td style={styles.td}>
                          {sedangEdit ? renderInput("email", { autoComplete: "username", type: "email" }) : <span style={styles.wrapText}>{item.email}</span>}
                        </td>
                        <td style={styles.td}>
                          {sedangEdit ? renderInput("jabatan") : <span style={styles.wrapText}>{item.jabatan || "-"}</span>}
                        </td>
                        <td style={styles.td}>
                          {sedangEdit ? renderInput("divisi", { placeholder: "Operasional" }) : <span style={styles.wrapText}>{item.divisi || "-"}</span>}
                        </td>
                        <td style={styles.td}>
                          {sedangEdit ? (
                            <select value={form.kantorId} onChange={(e) => setForm((prev) => ({ ...prev, kantorId: e.target.value }))} style={styles.input}>
                              <option value="">Pilih kantor...</option>
                              {kantor.map((k) => <option key={k.id} value={k.id}>{k.namaKantor}</option>)}
                            </select>
                          ) : <span style={styles.wrapText}>{item.kantor?.namaKantor || "Belum ditentukan"}</span>}
                        </td>
                        <td style={{ ...styles.td, ...styles.actionCell }}>
                          {sedangEdit ? (
                            <div style={styles.actions}>
                              <button type="button" onClick={() => setEditId(null)} style={styles.cancel}>Batal</button>
                              <button type="button" disabled={simpanId === item.id} onClick={() => void simpanEdit(item.id)} style={styles.save}>
                                {simpanId === item.id ? "Menyimpan..." : "Simpan"}
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => mulaiEdit(item)} style={styles.edit}><Edit3 size={14} /> Edit</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="admin-edit-mobile-list">
              {hasil.map((item) => {
                const sedangEdit = editId === item.id;
                return (
                  <article key={item.id} style={styles.mobileCard}>
                    <div style={styles.mobileHead}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={styles.mobileName}>{item.nama}</strong>
                        <span style={styles.mobileOffice}>{item.kantor?.namaKantor || "Belum ditentukan"}</span>
                      </div>
                      {!sedangEdit && <button type="button" onClick={() => mulaiEdit(item)} style={styles.mobileEdit}><Edit3 size={14} /> Edit</button>}
                    </div>

                    {sedangEdit ? (
                      <div style={styles.mobileForm}>
                        <label style={styles.mobileLabel}>Email{renderInput("email", { autoComplete: "username", type: "email" })}</label>
                        <label style={styles.mobileLabel}>Jabatan{renderInput("jabatan")}</label>
                        <label style={styles.mobileLabel}>Divisi{renderInput("divisi", { placeholder: "Operasional" })}</label>
                        <label style={styles.mobileLabel}>Kantor
                          <select value={form.kantorId} onChange={(e) => setForm((prev) => ({ ...prev, kantorId: e.target.value }))} style={styles.input}>
                            <option value="">Pilih kantor...</option>
                            {kantor.map((k) => <option key={k.id} value={k.id}>{k.namaKantor}</option>)}
                          </select>
                        </label>
                        <div style={styles.mobileActions}>
                          <button type="button" onClick={() => setEditId(null)} style={styles.cancel}>Batal</button>
                          <button type="button" disabled={simpanId === item.id} onClick={() => void simpanEdit(item.id)} style={styles.save}>
                            {simpanId === item.id ? "Menyimpan..." : "Simpan Perubahan"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={styles.mobileDetails}>
                        <div><span>Email</span><strong>{item.email}</strong></div>
                        <div><span>Jabatan</span><strong>{item.jabatan || "-"}</strong></div>
                        <div><span>Divisi</span><strong>{item.divisi || "-"}</strong></div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      <style>{`
        .spin{animation:adminEditSpin 1s linear infinite}
        @keyframes adminEditSpin{to{transform:rotate(360deg)}}
        .admin-edit-mobile-list{display:none}
        @media (max-width: 900px){
          .admin-edit-desktop-table{display:none}
          .admin-edit-mobile-list{display:grid;gap:10px;padding:10px}
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: "100svh", width: "100%", padding: "24px clamp(16px, 3vw, 32px) 32px", boxSizing: "border-box", background: warna.latar, color: warna.tinta, fontFamily: font.display },
  header: { width: "100%", maxWidth: 1440, margin: "0 auto 18px", display: "grid", gap: 12 },
  back: { width: "fit-content", minHeight: 40, display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${warna.garis}`, borderRadius: radius.sedang, background: warna.panel, color: warna.tintaLembut, boxShadow: "0 1px 2px rgba(22,35,61,0.03)", cursor: "pointer", padding: "8px 12px", fontSize: teks.badan, fontWeight: 600, fontFamily: font.display },
  title: { margin: 0, fontSize: teks.hero, lineHeight: 1.15, letterSpacing: "-0.02em" },
  subtitle: { margin: "6px 0 0", color: warna.tintaSamar, fontSize: teks.badan, lineHeight: 1.5 },
  toolbar: { width: "100%", maxWidth: 1440, margin: "0 auto 14px", display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: radius.sedang, boxSizing: "border-box" },
  search: { width: "100%", border: 0, outline: 0, background: "transparent", fontSize: teks.badan, color: warna.tinta, fontFamily: font.display },
  card: { width: "100%", maxWidth: 1440, margin: "0 auto", background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: radius.besar, overflow: "hidden", boxShadow: bayangan },
  table: { width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontFamily: font.display },
  th: { padding: "12px 14px", textAlign: "left", fontSize: teks.kecil, fontWeight: 700, lineHeight: 1.35, color: warna.tintaSamar, background: warna.panelAlt, borderBottom: `1px solid ${warna.garis}` },
  thAksi: { padding: "12px 14px", textAlign: "center", fontSize: teks.kecil, fontWeight: 700, lineHeight: 1.35, color: warna.tintaSamar, background: warna.panelAlt, borderBottom: `1px solid ${warna.garis}` },
  td: { padding: "13px 14px", fontSize: teks.badan, lineHeight: 1.45, color: warna.tinta, borderBottom: `1px solid ${warna.garis}`, verticalAlign: "middle", overflow: "hidden" },
  wrapText: { display: "block", overflowWrap: "anywhere", wordBreak: "break-word", whiteSpace: "normal" },
  namaCell: { display: "block", overflowWrap: "break-word", wordBreak: "normal", whiteSpace: "normal" },
  input: { width: "100%", minWidth: 0, minHeight: 40, boxSizing: "border-box", padding: "8px 9px", border: `1px solid ${warna.garis}`, borderRadius: radius.kecil, outline: 0, color: warna.tinta, background: warna.panel, fontSize: teks.badan, fontFamily: font.display },
  actionCell: { textAlign: "center", whiteSpace: "normal" },
  actions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, width: "100%" },
  edit: { width: "100%", minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tinta, borderRadius: radius.sedang, padding: "8px 9px", cursor: "pointer", fontSize: teks.badan, fontWeight: 600, fontFamily: font.display },
  cancel: { minHeight: 40, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tintaLembut, borderRadius: radius.sedang, padding: "8px 10px", cursor: "pointer", fontSize: teks.badan, fontFamily: font.display },
  save: { minHeight: 40, border: 0, background: warna.aksen, color: "#fff", borderRadius: radius.sedang, padding: "8px 10px", cursor: "pointer", fontSize: teks.badan, fontWeight: 700, fontFamily: font.display },
  loading: { minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: warna.tintaSamar, fontSize: teks.badan },
  empty: { padding: 56, textAlign: "center", color: warna.tintaSamar, fontSize: teks.badan },
  error: { width: "100%", maxWidth: 1440, margin: "0 auto 12px", display: "flex", gap: 7, alignItems: "center", padding: "10px 12px", borderRadius: radius.sedang, background: warna.bahayaLembut, color: warna.bahaya, fontSize: teks.badan, boxSizing: "border-box" },
  success: { width: "100%", maxWidth: 1440, margin: "0 auto 12px", display: "flex", gap: 7, alignItems: "center", padding: "10px 12px", borderRadius: radius.sedang, background: warna.suksesLembut, color: warna.sukses, fontSize: teks.badan, boxSizing: "border-box" },
  mobileCard: { border: `1px solid ${warna.garis}`, borderRadius: radius.sedang, background: warna.panel, padding: 14, boxShadow: "0 2px 10px rgba(22,35,61,0.04)" },
  mobileHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingBottom: 10, borderBottom: `1px solid ${warna.garis}` },
  mobileName: { display: "block", fontSize: 15, lineHeight: 1.3, color: warna.tinta },
  mobileOffice: { display: "block", marginTop: 3, fontSize: 11.5, color: warna.tintaSamar },
  mobileEdit: { flexShrink: 0, minHeight: 38, display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${warna.garis}`, borderRadius: radius.sedang, background: warna.panel, color: warna.tinta, padding: "8px 10px", fontSize: 12, fontWeight: 700, fontFamily: font.display },
  mobileDetails: { display: "grid", gap: 9, paddingTop: 10 },
  mobileDetails: { display: "grid", gap: 9, paddingTop: 10 },
  mobileDetails: undefined,
};

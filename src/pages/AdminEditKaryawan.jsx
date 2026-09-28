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
      try {
        const headers = { Authorization: `Bearer ${getToken()}` };
        const [rk, ro] = await Promise.all([
          fetch(`${API_URL}/admin/karyawan`, { headers, signal: controller.signal }),
          fetch(`${API_URL}/admin/kantor`, { headers, signal: controller.signal }),
        ]);
        const [dk, doff] = await Promise.all([rk.json().catch(() => ({})), ro.json().catch(() => ({}))]);
        if (!rk.ok) throw new Error(dk?.pesan || "Gagal memuat karyawan.");
        if (!ro.ok) throw new Error(doff?.pesan || "Gagal memuat kantor.");
        if (aktif) {
          setKaryawan(Array.isArray(dk.data) ? dk.data : []);
          setKantor(Array.isArray(doff.data) ? doff.data : []);
        }
      } catch (error) {
        if (error?.name !== "AbortError" && aktif) setPesan(error.message || "Tidak bisa terhubung ke server.");
      } finally {
        if (aktif) setLoading(false);
      }
    }
    void muatData();
    return () => { aktif = false; controller.abort(); };
  }, []);

  function mulaiEdit(item) {
    setEditId(item.id);
    setForm({ email: item.email || "", jabatan: item.jabatan || "", divisi: item.divisi || "", kantorId: item.kantor?.id ? String(item.kantor.id) : "" });
    setPesan("");
    setSukses("");
  }

  async function simpanEdit(id) {
    const email = form.email.trim().toLowerCase();
    const jabatan = form.jabatan.trim();
    const divisi = form.divisi.trim();
    const kantorId = form.kantorId.trim();
    if (!email || !email.includes("@")) { setPesan("Format email belum benar."); return; }
    if (!jabatan) { setPesan("Jabatan wajib diisi."); return; }
    if (!kantorId) { setPesan("Kantor kerja wajib dipilih."); return; }
    setSimpanId(id); setPesan(""); setSukses("");
    try {
      const res = await fetch(`${API_URL}/admin/karyawan/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ email, jabatan, divisi, kantorId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.pesan || "Gagal menyimpan data karyawan.");
      setKaryawan((lama) => lama.map((item) => item.id === id ? { ...item, ...(data?.data || {}) } : item));
      setEditId(null); setSukses(data.pesan || "Data karyawan berhasil diperbarui.");
    } catch (error) { setPesan(error.message || "Tidak bisa terhubung ke server."); }
    finally { setSimpanId(null); }
  }

  const hasil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return karyawan;
    return karyawan.filter((item) => `${item.nama} ${item.email} ${item.jabatan || ""} ${item.divisi || ""} ${item.kantor?.namaKantor || ""}`.toLowerCase().includes(q));
  }, [karyawan, cari]);

  const input = (field, extra = {}) => (
    <input value={form[field]} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} style={styles.input} {...extra} />
  );

  const selectKantor = (
    <select value={form.kantorId} onChange={(e) => setForm((p) => ({ ...p, kantorId: e.target.value }))} style={styles.input}>
      <option value="">Pilih kantor...</option>
      {kantor.map((k) => <option key={k.id} value={k.id}>{k.namaKantor}</option>)}
    </select>
  );

  const aksi = (item, mobile = false) => {
    const sedangEdit = editId === item.id;
    if (sedangEdit) return (
      <div style={mobile ? styles.mobileActions : styles.actions}>
        <button type="button" onClick={() => setEditId(null)} style={styles.cancel}>Batal</button>
        <button type="button" disabled={simpanId === item.id} onClick={() => void simpanEdit(item.id)} style={styles.save}>
          {simpanId === item.id ? "Menyimpan..." : mobile ? "Simpan Perubahan" : "Simpan"}
        </button>
      </div>
    );
    return <button type="button" onClick={() => mulaiEdit(item)} style={mobile ? styles.mobileEdit : styles.edit}><Edit3 size={14} /> Edit</button>;
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button type="button" onClick={() => navigate("/admin")} style={styles.back}><ArrowLeft size={17} /> Kembali ke Dashboard</button>
        <div><h1 style={styles.title}>Edit Data Karyawan</h1><p style={styles.subtitle}>Perbarui email, jabatan, divisi, dan kantor kerja tanpa mengubah password karyawan.</p></div>
      </div>
      {pesan && <div style={styles.alertError}><X size={17} /> {pesan}</div>}
      {sukses && <div style={styles.alertSuccess}><CheckCircle2 size={17} /> {sukses}</div>}
      <div style={styles.toolbar}><Search size={17} color={warna.tintaSamar} /><input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, email, jabatan, divisi, atau kantor..." style={styles.search} /></div>
      <section style={styles.card}>
        {loading ? <div style={styles.loading}><LoaderCircle className="spin" size={20} /> Memuat karyawan...</div> : hasil.length === 0 ? <div style={styles.empty}>Tidak ada karyawan yang ditemukan.</div> : <>
          <div className="edit-karyawan-desktop">
            <table style={styles.table}>
              <colgroup><col style={{width:"18%"}}/><col style={{width:"23%"}}/><col style={{width:"14%"}}/><col style={{width:"13%"}}/><col style={{width:"16%"}}/><col style={{width:"16%"}}/></colgroup>
              <thead><tr>{["Nama","Email","Jabatan","Divisi","Kantor","Aksi"].map((x,i)=><th key={x} style={i===5?styles.thAction:styles.th}>{x}</th>)}</tr></thead>
              <tbody>{hasil.map((item)=>{const sedangEdit=editId===item.id; return <tr key={item.id}>
                <td style={styles.td}><strong style={styles.name}>{item.nama}</strong></td>
                <td style={styles.td}>{sedangEdit?input("email",{type:"email",autoComplete:"username"}):<span style={styles.cellText}>{item.email}</span>}</td>
                <td style={styles.td}>{sedangEdit?input("jabatan"):<span style={styles.cellText}>{item.jabatan||"-"}</span>}</td>
                <td style={styles.td}>{sedangEdit?input("divisi",{placeholder:"Operasional"}):<span style={styles.cellText}>{item.divisi||"-"}</span>}</td>
                <td style={styles.td}>{sedangEdit?selectKantor:<span style={styles.cellText}>{item.kantor?.namaKantor||"Belum ditentukan"}</span>}</td>
                <td style={{...styles.td,...styles.actionCell}}>{aksi(item)}</td>
              </tr>})}</tbody>
            </table>
          </div>
          <div className="edit-karyawan-mobile">
            {hasil.map((item)=>{const sedangEdit=editId===item.id; return <article key={item.id} style={styles.mobileCard}>
              <div style={styles.mobileTop}><div style={{minWidth:0}}><strong style={styles.mobileName}>{item.nama}</strong><span style={styles.mobileOffice}>{item.kantor?.namaKantor||"Belum ditentukan"}</span></div>{aksi(item,true)}</div>
              {sedangEdit ? <div style={styles.mobileForm}>
                <label style={styles.label}>Email{input("email",{type:"email",autoComplete:"username"})}</label>
                <label style={styles.label}>Jabatan{input("jabatan")}</label>
                <label style={styles.label}>Divisi{input("divisi",{placeholder:"Operasional"})}</label>
                <label style={styles.label}>Kantor{selectKantor}</label>
              </div> : <div style={styles.mobileDetails}>
                <div><span>Email</span><strong>{item.email}</strong></div><div><span>Jabatan</span><strong>{item.jabatan||"-"}</strong></div><div><span>Divisi</span><strong>{item.divisi||"-"}</strong></div>
              </div>}
            </article>})}
          </div>
        </>}
      </section>
      <style>{`.spin{animation:editSpin 1s linear infinite}@keyframes editSpin{to{transform:rotate(360deg)}}.edit-karyawan-mobile{display:none}@media(max-width:900px){.edit-karyawan-desktop{display:none}.edit-karyawan-mobile{display:grid;gap:10px;padding:10px}}`}</style>
    </div>
  );
}

const styles = {
  page:{minHeight:"100svh",width:"100%",padding:"24px clamp(16px,3vw,32px) 32px",boxSizing:"border-box",background:warna.latar,color:warna.tinta,fontFamily:font.display},
  header:{width:"100%",maxWidth:1440,margin:"0 auto 18px",display:"grid",gap:12},
  back:{width:"fit-content",minHeight:40,display:"inline-flex",alignItems:"center",gap:7,border:`1px solid ${warna.garis}`,borderRadius:radius.sedang,background:warna.panel,color:warna.tintaLembut,cursor:"pointer",padding:"8px 12px",fontSize:teks.badan,fontWeight:600,fontFamily:font.display},
  title:{margin:0,fontSize:teks.hero,lineHeight:1.15,letterSpacing:"-0.02em"},
  subtitle:{margin:"6px 0 0",color:warna.tintaSamar,fontSize:teks.badan,lineHeight:1.5},
  toolbar:{width:"100%",maxWidth:1440,margin:"0 auto 14px",display:"flex",alignItems:"center",gap:8,padding:"11px 12px",background:warna.panel,border:`1px solid ${warna.garis}`,borderRadius:radius.sedang,boxSizing:"border-box"},
  search:{width:"100%",border:0,outline:0,background:"transparent",fontSize:teks.badan,color:warna.tinta,fontFamily:font.display},
  card:{width:"100%",maxWidth:1440,margin:"0 auto",background:warna.panel,border:`1px solid ${warna.garis}`,borderRadius:radius.besar,overflow:"hidden",boxShadow:bayangan},
  table:{width:"100%",tableLayout:"fixed",borderCollapse:"collapse",fontFamily:font.display},
  th:{padding:"12px 14px",textAlign:"left",fontSize:teks.kecil,fontWeight:700,lineHeight:1.35,color:warna.tintaSamar,background:warna.panelAlt,borderBottom:`1px solid ${warna.garis}`},
  thAction:{padding:"12px 10px",textAlign:"center",fontSize:teks.kecil,fontWeight:700,lineHeight:1.35,color:warna.tintaSamar,background:warna.panelAlt,borderBottom:`1px solid ${warna.garis}`},
  td:{padding:"13px 12px",fontSize:teks.badan,lineHeight:1.45,color:warna.tinta,borderBottom:`1px solid ${warna.garis}`,verticalAlign:"middle",overflow:"hidden"},
  cellText:{display:"block",overflowWrap:"anywhere",wordBreak:"break-word",whiteSpace:"normal"},
  name:{display:"block",overflowWrap:"break-word",wordBreak:"normal",whiteSpace:"normal"},
  input:{width:"100%",minWidth:0,minHeight:40,boxSizing:"border-box",padding:"8px 9px",border:`1px solid ${warna.garis}`,borderRadius:radius.kecil,outline:0,color:warna.tinta,background:warna.panel,fontSize:teks.badan,fontFamily:font.display},
  actionCell:{textAlign:"center"},
  actions:{display:"grid",gridTemplateColumns:"1fr 1.15fr",gap:6,width:"100%"},
  edit:{width:"100%",minHeight:40,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,border:`1px solid ${warna.garis}`,background:warna.panel,color:warna.tinta,borderRadius:radius.sedang,padding:"8px 8px",cursor:"pointer",fontSize:teks.kecil,fontWeight:700,fontFamily:font.display},
  cancel:{minHeight:40,border:`1px solid ${warna.garis}`,background:warna.panel,color:warna.tintaLembut,borderRadius:radius.sedang,padding:"8px 10px",cursor:"pointer",fontSize:teks.badan,fontFamily:font.display},
  save:{minHeight:40,border:0,background:warna.aksen,color:"#fff",borderRadius:radius.sedang,padding:"8px 10px",cursor:"pointer",fontSize:teks.badan,fontWeight:700,fontFamily:font.display},
  loading:{minHeight:240,display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:warna.tintaSamar,fontSize:teks.badan},
  empty:{padding:56,textAlign:"center",color:warna.tintaSamar,fontSize:teks.badan},
  alertError:{width:"100%",maxWidth:1440,margin:"0 auto 12px",display:"flex",gap:7,alignItems:"center",padding:"10px 12px",borderRadius:radius.sedang,background:warna.bahayaLembut,color:warna.bahaya,fontSize:teks.badan,boxSizing:"border-box"},
  alertSuccess:{width:"100%",maxWidth:1440,margin:"0 auto 12px",display:"flex",gap:7,alignItems:"center",padding:"10px 12px",borderRadius:radius.sedang,background:warna.suksesLembut,color:warna.sukses,fontSize:teks.badan,boxSizing:"border-box"},
  mobileCard:{border:`1px solid ${warna.garis}`,borderRadius:radius.sedang,background:warna.panel,padding:14,boxShadow:"0 2px 10px rgba(22,35,61,0.04)"},
  mobileTop:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,paddingBottom:10,borderBottom:`1px solid ${warna.garis}`},
  mobileName:{display:"block",fontSize:15,lineHeight:1.3,color:warna.tinta},
  mobileOffice:{display:"block",marginTop:3,fontSize:11.5,color:warna.tintaSamar},
  mobileEdit:{flexShrink:0,minHeight:38,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,border:`1px solid ${warna.garis}`,background:warna.panel,color:warna.tinta,borderRadius:radius.sedang,padding:"8px 10px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:font.display},
  mobileDetails:{display:"grid",gap:9,paddingTop:10},
  label:{display:"grid",gap:5,fontSize:12,fontWeight:700,color:warna.tinta},
  mobileForm:{display:"grid",gap:11,paddingTop:12},
  mobileActions:{display:"grid",gridTemplateColumns:"1fr 1.5fr",gap:8,width:"100%",marginTop:12},
};

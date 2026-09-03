import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import TopbarHijau from "../components/TopbarHijau";
import { FileEdit, RefreshCcw, AlertCircle, CheckCircle2, UploadCloud, FileText } from "lucide-react";

const MAKS_LAMPIRAN_BYTES = 8 * 1024 * 1024;

export default function PengajuanIzin({ kembali }) {
  const [tanggal, setTanggal] = useState("");
  const [jenis, setJenis] = useState("izin");
  const [keterangan, setKeterangan] = useState("");
  const [fotoSurat, setFotoSurat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState("");
  const [pesanTipe, setPesanTipe] = useState("error");
  const [riwayat, setRiwayat] = useState([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(true);
  const [errorRiwayat, setErrorRiwayat] = useState("");

  useEffect(() => { void ambilRiwayat(); }, []);
  useEffect(() => { if (!pesan) return; const timer = setTimeout(() => setPesan(""), 5000); return () => clearTimeout(timer); }, [pesan]);

  async function ambilRiwayat() {
    setLoadingRiwayat(true); setErrorRiwayat("");
    try {
      const res = await fetch(`${API_URL}/izin/riwayat-saya`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.pesan || "Gagal memuat riwayat pengajuan.");
      setRiwayat(Array.isArray(data.data) ? data.data : []);
    } catch (err) { console.error(err); setRiwayat([]); setErrorRiwayat(err?.message || "Gagal memuat riwayat pengajuan."); }
    finally { setLoadingRiwayat(false); }
  }

  function pilihLampiran(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const tipeDibolehkan = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!tipeDibolehkan) { setPesan("Lampiran harus berupa foto (JPG/PNG/WebP, dll.) atau PDF."); setPesanTipe("error"); e.target.value = ""; return; }
    if (file.size > MAKS_LAMPIRAN_BYTES) { setPesan("Ukuran lampiran maksimal 8 MB."); setPesanTipe("error"); e.target.value = ""; return; }
    setFotoSurat(file); setPesan("");
  }

  async function kirimPengajuan(e) {
    e.preventDefault(); setPesan("");
    const keteranganBersih = keterangan.trim();
    if (!tanggal || !keteranganBersih) { setPesan("Tanggal dan keterangan wajib diisi."); setPesanTipe("error"); return; }
    if (jenis === "sakit" && !fotoSurat) { setPesan("Untuk pengajuan Sakit, surat sakit wajib dilampirkan dalam bentuk foto atau PDF."); setPesanTipe("error"); return; }
    setLoading(true);
    const formData = new FormData();
    formData.append("tanggal", tanggal); formData.append("jenis", jenis); formData.append("keterangan", keteranganBersih);
    if (fotoSurat) formData.append("fotoSurat", fotoSurat);
    try {
      const res = await fetch(`${API_URL}/izin/ajukan`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setPesan(data.pesan || "Gagal mengirim pengajuan."); setPesanTipe("error"); return; }
      setPesan("Pengajuan berhasil dikirim, menunggu persetujuan Admin."); setPesanTipe("sukses");
      setTanggal(""); setJenis("izin"); setKeterangan(""); setFotoSurat(null); await ambilRiwayat();
    } catch (err) { console.error(err); setPesan("Tidak bisa terhubung ke server."); setPesanTipe("error"); }
    finally { setLoading(false); }
  }

  function labelStatus(status) {
    if (status === "disetujui") return { teks: "Disetujui", warna: warna.sukses, latar: warna.suksesLembut };
    if (status === "ditolak") return { teks: "Ditolak", warna: warna.bahaya, latar: warna.bahayaLembut };
    return { teks: "Menunggu Persetujuan", warna: warna.peringatan, latar: warna.peringatanLembut };
  }
  function labelJenis(value) { return ({ izin: "Izin", sakit: "Sakit", cuti: "Cuti", urgent: "Urgent" })[value] || value; }

  return (
    <div style={styles.wrapper}><div style={styles.shell}><TopbarHijau judul="Pengajuan Izin / Sakit / Cuti" kembali={kembali} />
      <div style={styles.content}>
        <div style={styles.card}>
          <div style={styles.formHeader}><div style={styles.formIcon}><FileEdit size={20} /></div><div><p style={styles.formTitle}>Ajukan ketidakhadiran</p><p style={styles.formSubtitle}>Isi data dengan lengkap agar Admin dapat memproses pengajuan.</p></div></div>
          <form onSubmit={kirimPengajuan}>
            <label style={styles.label}>Tanggal</label>
            <input type="date" value={tanggal} onChange={(e) => { setTanggal(e.target.value); setPesan(""); }} style={styles.input} />
            <label style={styles.label}>Jenis Pengajuan</label>
            <select value={jenis} onChange={(e) => { setJenis(e.target.value); setPesan(""); }} style={styles.input}>
              <option value="izin">Izin</option><option value="sakit">Sakit</option><option value="cuti">Cuti</option><option value="urgent">Urgent</option>
            </select>
            <label style={styles.label}>Keterangan</label>
            <textarea value={keterangan} onChange={(e) => { setKeterangan(e.target.value); setPesan(""); }} placeholder="Contoh: Demam sejak semalam, perlu istirahat." rows={4} style={{ ...styles.input, resize: "vertical", minHeight: 108 }} />
            <div style={styles.uploadBox}>
              <label style={styles.label}>{jenis === "sakit" ? "Surat Sakit (wajib)" : "Lampiran Surat (opsional)"}</label>
              <label style={styles.uploadLabel}><UploadCloud size={18} /><span>{fotoSurat ? "Ganti lampiran" : "Pilih foto atau PDF"}</span><input type="file" accept="image/*,application/pdf" onChange={pilihLampiran} style={styles.fileInput} /></label>
              <div style={styles.fileInfo}><FileText size={14} /><span>{fotoSurat ? fotoSurat.name : "Belum ada lampiran"}</span></div>
              <p style={styles.keteranganUpload}>Maksimal 8 MB. Foto diproses otomatis; PDF disimpan sebagai dokumen.</p>
            </div>
            <button type="submit" style={styles.tombolUtama} disabled={loading}>{loading ? "Mengirim…" : "Kirim Pengajuan"}</button>
          </form>
          {pesan && <div style={{ ...styles.pesanInfo, borderLeftColor: pesanTipe === "sukses" ? warna.sukses : warna.bahaya, background: pesanTipe === "sukses" ? warna.suksesLembut : warna.bahayaLembut }} role="alert">{pesanTipe === "sukses" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}<span>{pesan}</span></div>}
        </div>

        <div style={styles.riwayatHeader}><div><p style={styles.subjudul}>Riwayat Pengajuan</p><p style={styles.riwayatHint}>Pantau status pengajuan yang pernah kamu kirim.</p></div>{!loadingRiwayat && !errorRiwayat && <span style={styles.jumlahBadge}>{riwayat.length} data</span>}</div>
        {loadingRiwayat && <p style={styles.info}>Memuat riwayat…</p>}
        {!loadingRiwayat && errorRiwayat && <div style={styles.errorBox} role="alert"><AlertCircle size={18} /><div style={{ flex: 1 }}><strong style={styles.errorTitle}>Riwayat belum dapat dimuat</strong><p style={styles.errorText}>{errorRiwayat}</p><button type="button" onClick={() => void ambilRiwayat()} style={styles.retryButton}><RefreshCcw size={14} /> Coba Lagi</button></div></div>}
        {!loadingRiwayat && !errorRiwayat && riwayat.length === 0 && <div style={styles.kosongBox}><FileEdit size={28} strokeWidth={1.6} style={styles.kosongIkon} /><p style={styles.kosongTitle}>Belum ada pengajuan</p><p style={styles.kosongText}>Pengajuan yang kamu kirim akan muncul di sini beserta status persetujuannya.</p></div>}
        {!loadingRiwayat && !errorRiwayat && riwayat.map((item) => {
          const status = labelStatus(item.status);
          const tanggalTampil = new Date(item.tanggal).toLocaleDateString("id-ID", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
          return <div key={item.id} style={styles.itemCard} className="kartu-hover"><div style={styles.itemHeader}><div style={{ minWidth: 0 }}><strong style={styles.itemNama}>{labelJenis(item.jenis)}</strong><p style={styles.itemTanggal}>{tanggalTampil}</p></div><span style={{ ...styles.badge, color: status.warna, background: status.latar }}>{status.teks}</span></div><p style={styles.itemDetail}>{item.keterangan}</p>{item.fotoSuratUrl && <a href={item.fotoSuratUrl} target="_blank" rel="noopener noreferrer" style={styles.linkLampiran}><FileText size={14} /> Lihat lampiran</a>}{item.catatanAdmin && <p style={styles.catatan}>Catatan Admin: {item.catatanAdmin}</p>}</div>;
        })}
      </div>
    </div></div>
  );
}

const styles = {
  wrapper:{minHeight:"100svh",background:warna.latar,fontFamily:font.display,padding:16},shell:{maxWidth:460,margin:"0 auto"},content:{},card:{background:warna.panel,borderRadius:14,padding:"20px 18px",marginBottom:20,border:`1px solid ${warna.garis}`,boxShadow:"0 1px 2px rgba(22,35,61,.04),0 8px 24px rgba(22,35,61,.06)"},formHeader:{display:"flex",alignItems:"center",gap:11,marginBottom:16},formIcon:{width:38,height:38,borderRadius:10,background:warna.aksenLembut,color:warna.aksen,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},formTitle:{fontSize:15,fontWeight:700,color:warna.tinta,margin:0},formSubtitle:{margin:"3px 0 0",fontSize:11.5,lineHeight:1.45,color:warna.tintaSamar},label:{display:"block",fontSize:12.5,fontWeight:700,marginBottom:6,marginTop:14,color:warna.tinta},input:{width:"100%",padding:"11px 12px",borderRadius:10,border:`1px solid ${warna.garis}`,fontSize:14,fontFamily:"inherit",boxSizing:"border-box",color:warna.tinta,background:warna.panel,colorScheme:"light"},uploadBox:{marginTop:2,padding:"10px 12px 12px",borderRadius:11,background:warna.panelAlt,border:`1px solid ${warna.garis}`},uploadLabel:{minHeight:44,display:"flex",alignItems:"center",justifyContent:"center",gap:8,borderRadius:10,border:`1px dashed ${warna.garis}`,background:warna.panel,color:warna.tinta,fontSize:12.5,fontWeight:700,cursor:"pointer"},fileInput:{display:"none"},fileInfo:{display:"flex",alignItems:"center",gap:6,marginTop:8,color:warna.tinta,fontSize:11.5,fontWeight:600,minWidth:0},keteranganUpload:{margin:"7px 0 0",fontSize:11,color:warna.tintaSamar,lineHeight:1.45},tombolUtama:{width:"100%",minHeight:46,padding:"12px 13px",background:warna.aksen,color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",marginTop:18},pesanInfo:{marginTop:14,display:"flex",alignItems:"flex-start",gap:8,fontSize:12.5,color:warna.tinta,padding:"11px 12px",borderRadius:9,borderLeft:`3px solid ${warna.aksen}`,lineHeight:1.5},riwayatHeader:{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:10,marginBottom:9},subjudul:{fontSize:13.5,fontWeight:700,color:warna.tinta,margin:0},riwayatHint:{margin:"3px 0 0",fontSize:11.5,color:warna.tintaSamar},jumlahBadge:{padding:"4px 9px",borderRadius:999,background:warna.panelAlt,color:warna.tintaLembut,fontSize:10.5,fontWeight:700,whiteSpace:"nowrap"},info:{textAlign:"center",color:warna.tintaSamar,padding:20,fontSize:13},errorBox:{display:"flex",alignItems:"flex-start",gap:10,padding:14,marginBottom:10,borderRadius:11,border:`1px solid ${warna.bahayaLembut}`,background:warna.bahayaLembut,color:warna.bahaya},errorTitle:{display:"block",fontSize:13,color:warna.tinta},errorText:{margin:"4px 0 10px",fontSize:12,color:warna.tintaLembut,lineHeight:1.5},retryButton:{display:"inline-flex",alignItems:"center",gap:6,minHeight:38,padding:"8px 12px",borderRadius:9,border:`1px solid ${warna.garis}`,background:warna.panel,color:warna.tinta,fontSize:12,fontWeight:700,cursor:"pointer"},kosongBox:{textAlign:"center",padding:"42px 20px",background:warna.panel,borderRadius:12,border:`1px dashed ${warna.garis}`},kosongIkon:{display:"block",marginBottom:10,marginLeft:"auto",marginRight:"auto",color:warna.tintaSamar},kosongTitle:{color:warna.tinta,fontSize:14,fontWeight:700,margin:0},kosongText:{color:warna.tintaSamar,fontSize:12,lineHeight:1.55,maxWidth:300,margin:"6px auto 0"},itemCard:{background:warna.panel,borderRadius:12,padding:16,marginBottom:9,border:`1px solid ${warna.garis}`},itemHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:7},itemNama:{fontSize:13.5,color:warna.tinta},itemTanggal:{margin:"3px 0 0",fontSize:11.5,color:warna.tintaSamar},itemDetail:{fontSize:12.5,color:warna.tinta,margin:"9px 0",lineHeight:1.5},linkLampiran:{display:"inline-flex",alignItems:"center",gap:6,color:warna.aksen,fontSize:11.5,fontWeight:700,textDecoration:"none"},badge:{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:7,whiteSpace:"nowrap"},catatan:{fontSize:11.5,color:warna.tinta,background:warna.panelAlt,padding:"7px 10px",borderRadius:8,marginTop:9,borderLeft:`3px solid ${warna.aksen}`,lineHeight:1.45}
};

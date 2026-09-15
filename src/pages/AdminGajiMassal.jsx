import { useEffect, useRef, useState } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import { Wallet, Download, Upload, CheckCircle2, AlertTriangle, XCircle, Save, RefreshCw } from "lucide-react";

const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_GAJI = 999999999999;

function formatRupiah(value) {
  const n = Number(value) || 0;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function formatAngka(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("id-ID") : "";
}

function parseNominalInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const number = Number(digits);
  return Number.isSafeInteger(number) && number <= MAX_GAJI ? number : null;
}

function normalisasiPreview(data) {
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return {
    ...data,
    total: Number(data?.total) || rows.length,
    rows: rows.map((row) => {
      const pesan = String(row?.pesan || "");
      return {
        ...row,
        _masalahIdentitas: !row?.email || /email\s+(kosong|duplikat|tidak ditemukan)/i.test(pesan),
      };
    }),
  };
}

export default function AdminGajiMassal() {
  const inputFileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [sedangImport, setSedangImport] = useState(false);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [pesan, setPesan] = useState("");
  const [pesanSukses, setPesanSukses] = useState("");
  const [namaFile, setNamaFile] = useState("");
  const [daftarGaji, setDaftarGaji] = useState([]);
  const [hasilPreview, setHasilPreview] = useState(null);
  const [cari, setCari] = useState("");

  useEffect(() => {
    void muatDaftarGaji();
  }, []);

  async function bacaJson(res) {
    const text = await res.text().catch(() => "");
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { pesan: text.slice(0, 300) };
    }
  }

  async function muatDaftarGaji({ silent = false } = {}) {
    if (!silent) setLoading(true);
    if (!silent) setPesan("");
    try {
      const res = await fetch(`${API_URL}/admin/gaji`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await bacaJson(res);
      if (!res.ok) throw new Error(data.pesan || "Gagal memuat data gaji.");
      setDaftarGaji(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setPesan(err?.message || "Gagal memuat data gaji.");
    } finally {
      setLoading(false);
    }
  }

  async function unduhTemplate() {
    setPesan("");
    setPesanSukses("");
    try {
      const res = await fetch(`${API_URL}/admin/gaji/template-massal`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const data = await bacaJson(res);
        throw new Error(data.pesan || "Gagal mengunduh template Excel.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Template_Gaji_Pokok_PT_Zaman_Teknindo.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setPesan(err?.message || "Gagal mengunduh template Excel.");
    }
  }

  async function pilihFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPesan("");
    setPesanSukses("");
    setHasilPreview(null);
    setNamaFile("");

    const nama = String(file.name || "").toLowerCase();
    const mime = String(file.type || "").toLowerCase();

    if (!nama.endsWith(".xlsx")) {
      setPesan("File harus berformat Excel .xlsx. Gunakan template yang disediakan sistem.");
      return;
    }

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setPesan("Ukuran file maksimal 2 MB.");
      return;
    }

    if (mime && mime !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      setPesan("Jenis file Excel tidak dikenali browser. Simpan ulang sebagai .xlsx lalu coba lagi.");
      return;
    }

    setNamaFile(file.name);
    setSedangImport(true);

    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      const res = await fetch(`${API_URL}/admin/gaji/import-preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await bacaJson(res);
      if (!res.ok) throw new Error(data.pesan || `Gagal memproses Excel (HTTP ${res.status}).`);
      if (!Array.isArray(data?.rows)) throw new Error("Respons preview Excel tidak valid. Coba muat ulang halaman lalu impor kembali.");
      setHasilPreview(normalisasiPreview(data));
    } catch (err) {
      console.error(err);
      setPesan(err?.message || "Gagal memproses Excel. Pastikan backend dapat diakses.");
    } finally {
      setSedangImport(false);
    }
  }

  function ubahNominal(index, value) {
    setHasilPreview((prev) => {
      if (!prev?.rows) return prev;

      return {
        ...prev,
        rows: prev.rows.map((row, i) => {
          if (i !== index) return row;

          const nominal = parseNominalInput(value);
          const nilaiTampil = String(value ?? "").replace(/\D/g, "");

          if (nominal === null) {
            return {
              ...row,
              gajiPokok: nilaiTampil,
              status: "error",
              pesan: nilaiTampil ? `Nominal gaji maksimal Rp ${MAX_GAJI.toLocaleString("id-ID")}.` : "Gaji pokok wajib diisi.",
            };
          }

          if (row._masalahIdentitas) {
            return {
              ...row,
              gajiPokok: String(nominal),
              status: "error",
              pesan: row.email ? row.pesan || "Perbaiki email/identitas karyawan pada Excel." : "Email wajib diisi.",
            };
          }

          return {
            ...row,
            gajiPokok: String(nominal),
            status: "siap",
            pesan: "Siap",
          };
        }),
      };
    });
  }

  async function simpanSemua() {
    if (!hasilPreview?.rows?.length) return;

    const rows = hasilPreview.rows;
    const siap = rows.filter((row) => {
      if (row.status === "error" || !row.email) return false;
      const nominal = Number(row.gajiPokok);
      return row.gajiPokok !== "" && Number.isSafeInteger(nominal) && nominal >= 0 && nominal <= MAX_GAJI;
    });

    if (siap.length !== rows.length) {
      setPesan("Masih ada baris yang bermasalah. Perbaiki baris merah terlebih dahulu sebelum menyimpan.");
      return;
    }

    setSedangSimpan(true);
    setPesan("");
    setPesanSukses("");
    try {
      const res = await fetch(`${API_URL}/admin/gaji/import-simpan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows: siap.map((row) => ({
            email: row.email,
            gajiPokok: Number(row.gajiPokok),
          })),
        }),
      });
      const data = await bacaJson(res);
      if (!res.ok) throw new Error(data.pesan || `Gagal menyimpan gaji massal (HTTP ${res.status}).`);
      setPesanSukses(data.pesan || "Semua gaji pokok berhasil disimpan.");
      setHasilPreview(null);
      setNamaFile("");
      void muatDaftarGaji({ silent: true });
    } catch (err) {
      console.error(err);
      setPesan(err?.message || "Gagal menyimpan gaji massal.");
    } finally {
      setSedangSimpan(false);
    }
  }

  const daftarTersaring = daftarGaji.filter((item) => {
    const q = cari.trim().toLowerCase();
    if (!q) return true;
    return `${item.nama || ""} ${item.email || ""} ${item.jabatan || ""} ${item.divisi || ""}`.toLowerCase().includes(q);
  });

  const previewError = hasilPreview?.rows?.filter((r) => r.status === "error").length || 0;
  const previewSiap = hasilPreview?.rows?.filter((r) => r.status !== "error").length || 0;

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <div>
          <p style={styles.eyebrow}>FINANCE · GAJI</p>
          <h2 style={styles.title}>Gaji Pokok Massal</h2>
          <p style={styles.subtitle}>
            Atur gaji pokok banyak karyawan sekaligus menggunakan Excel. Identitas karyawan dicocokkan berdasarkan email.
          </p>
        </div>
        <div style={styles.iconBox}><Wallet size={20} /></div>
      </div>

      <div style={styles.stepGrid}>
        <div style={styles.stepCard}><b>1. Download template</b><span>Gunakan format Excel yang sudah disediakan.</span></div>
        <div style={styles.stepCard}><b>2. Isi & impor</b><span>Masukkan Email, Nama, dan Gaji Pokok.</span></div>
        <div style={styles.stepCard}><b>3. Periksa & simpan</b><span>Data belum berubah sebelum Admin menekan Simpan.</span></div>
      </div>

      <div style={styles.actionBar}>
        <button type="button" onClick={unduhTemplate} style={styles.btnSecondary} disabled={sedangImport || sedangSimpan}>
          <Download size={16} /> Download Template Excel
        </button>
        <button type="button" onClick={() => inputFileRef.current?.click()} style={styles.btnPrimary} disabled={sedangImport || sedangSimpan}>
          <Upload size={16} /> {sedangImport ? "Memproses Excel…" : "Import Excel"}
        </button>
        <input ref={inputFileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={pilihFile} style={{ display: "none" }} />
        {namaFile && <span style={styles.fileName} title={namaFile}>File: {namaFile}</span>}
      </div>

      {sedangImport && <div style={styles.progressBox}><span style={styles.progressDot} /> Memvalidasi file Excel dan mencocokkan email karyawan…</div>}
      {pesan && <div style={styles.alertError}><AlertTriangle size={17} /><span>{pesan}</span></div>}
      {pesanSukses && <div style={styles.alertSuccess}><CheckCircle2 size={17} /><span>{pesanSukses}</span></div>}

      {hasilPreview && (
        <div style={styles.previewCard}>
          <div style={styles.previewHeader}>
            <div>
              <h3 style={styles.sectionTitle}>Preview Import</h3>
              <p style={styles.sectionSub}>{hasilPreview.total || hasilPreview.rows?.length || 0} baris · {previewSiap} siap · {previewError} bermasalah</p>
            </div>
            <button type="button" onClick={() => { setHasilPreview(null); setNamaFile(""); }} style={styles.btnTiny}><XCircle size={15} /> Tutup</button>
          </div>

          {previewError > 0 && <div style={styles.warningBox}><AlertTriangle size={16} /><span>Perbaiki baris merah sebelum menyimpan. Sistem tidak akan menyimpan sebagian data.</span></div>}

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead><tr><th>No</th><th>Email</th><th>Nama</th><th>Gaji Pokok</th><th>Status</th></tr></thead>
              <tbody>
                {(hasilPreview.rows || []).map((row, i) => (
                  <tr key={`${row.email || "kosong"}-${i}`} style={row.status === "error" ? styles.rowError : undefined}>
                    <td>{i + 1}</td>
                    <td>{row.email || "-"}</td>
                    <td>{row.nama || "-"}</td>
                    <td>
                      <input
                        value={formatAngka(row.gajiPokok)}
                        onChange={(e) => ubahNominal(i, e.target.value)}
                        style={styles.moneyInput}
                        inputMode="numeric"
                        disabled={sedangSimpan}
                        aria-label={`Gaji pokok baris ${i + 1}`}
                      />
                    </td>
                    <td>{row.status === "error" ? <span style={styles.statusError}><XCircle size={14} /> {row.pesan || "Tidak valid"}</span> : <span style={styles.statusOk}><CheckCircle2 size={14} /> {row.pesan || "Siap"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={styles.saveRow}>
            <span style={styles.note}>Database belum berubah sampai tombol simpan ditekan.</span>
            <button type="button" onClick={simpanSemua} style={styles.btnPrimary} disabled={sedangSimpan || sedangImport || previewError > 0}>
              <Save size={16} /> {sedangSimpan ? "Menyimpan…" : `Simpan ${previewSiap} Data`}
            </button>
          </div>
        </div>
      )}

      <div style={styles.listCard}>
        <div style={styles.listHeader}>
          <div><h3 style={styles.sectionTitle}>Gaji Pokok Saat Ini</h3><p style={styles.sectionSub}>Data karyawan aktif yang tersimpan di sistem.</p></div>
          <button type="button" onClick={() => void muatDaftarGaji()} style={styles.btnTiny}><RefreshCw size={14} /> Muat Ulang</button>
        </div>
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama atau email…" style={styles.search} />
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead><tr><th>Nama</th><th>Email</th><th>Jabatan / Divisi</th><th>Gaji Pokok</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={4} style={styles.empty}>Memuat data…</td></tr> : daftarTersaring.length === 0 ? <tr><td colSpan={4} style={styles.empty}>Tidak ada data.</td></tr> : daftarTersaring.map((item) => <tr key={item.id}><td><b>{item.nama}</b></td><td>{item.email}</td><td>{item.jabatan || "-"} · {item.divisi || "-"}</td><td>{item.gaji?.gajiPokok != null ? formatRupiah(item.gaji.gajiPokok) : <span style={styles.noSalary}>Belum diatur</span>}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", flexDirection: "column", gap: 16, fontFamily: font.display },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  eyebrow: { margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: warna.aksen },
  title: { margin: "4px 0 4px", fontSize: 24, color: warna.tinta },
  subtitle: { margin: 0, maxWidth: 760, fontSize: 12.5, lineHeight: 1.55, color: warna.tintaLembut },
  iconBox: { width: 42, height: 42, borderRadius: 10, background: warna.aksenLembut, color: warna.aksen, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepGrid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 },
  stepCard: { background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 },
  actionBar: { background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 12, padding: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  btnPrimary: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 14px", background: warna.aksen, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" },
  btnSecondary: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 14px", background: warna.panelAlt, color: warna.tinta, border: `1px solid ${warna.garis}`, borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" },
  btnTiny: { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px", background: "transparent", color: warna.tintaLembut, border: `1px solid ${warna.garis}`, borderRadius: 8, fontSize: 11.5, fontWeight: 600, cursor: "pointer" },
  fileName: { minWidth: 0, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "8px 10px", borderRadius: 8, background: warna.panelAlt, color: warna.tintaLembut, fontSize: 11.5 },
  progressBox: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: warna.panelAlt, color: warna.tintaLembut, borderRadius: 9, border: `1px solid ${warna.garis}`, fontSize: 12 },
  progressDot: { width: 9, height: 9, borderRadius: "50%", background: warna.aksen, boxShadow: `0 0 0 4px ${warna.aksenLembut}`, flexShrink: 0 },
  alertSuccess: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: warna.suksesLembut, color: warna.sukses, borderRadius: 9, fontSize: 12 },
  alertError: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: warna.bahayaLembut, color: warna.bahaya, borderRadius: 9, fontSize: 12 },
  warningBox: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: warna.peringatanLembut, color: warna.peringatan, borderRadius: 9, fontSize: 12, marginBottom: 10 },
  previewCard: { background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 12, padding: 14 },
  listCard: { background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 12, padding: 14 },
  previewHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 },
  listHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 },
  sectionTitle: { margin: 0, fontSize: 14, color: warna.tinta },
  sectionSub: { margin: "3px 0 0", fontSize: 11.5, color: warna.tintaSamar },
  tableWrap: { overflowX: "auto", border: `1px solid ${warna.garis}`, borderRadius: 10 },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 760 },
  search: { width: "100%", maxWidth: 360, boxSizing: "border-box", padding: "9px 12px", marginBottom: 10, border: `1px solid ${warna.garis}`, borderRadius: 9, fontSize: 12.5, fontFamily: font.display },
  moneyInput: { width: 150, boxSizing: "border-box", padding: "7px 9px", border: `1px solid ${warna.garis}`, borderRadius: 7, fontFamily: font.mono, fontSize: 12 },
  rowError: { background: warna.bahayaLembut },
  statusOk: { display: "inline-flex", alignItems: "center", gap: 5, color: warna.sukses, fontSize: 11 },
  statusError: { display: "inline-flex", alignItems: "center", gap: 5, color: warna.bahaya, fontSize: 11 },
  saveRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" },
  note: { color: warna.tintaSamar, fontSize: 11 },
  empty: { textAlign: "center", padding: 28, color: warna.tintaSamar, fontSize: 12.5 },
  noSalary: { color: warna.tintaSamar, fontSize: 11.5 },
};

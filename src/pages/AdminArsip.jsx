import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const STATUS_LABEL = {
  siap_dihapus: "Menunggu Cleanup",
  diproses: "Sedang Diproses",
  selesai: "Selesai",
  dibatalkan: "Dibatalkan",
  gagal: "Gagal — Akan Dicoba Lagi",
};

function formatTanggal(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAngka(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function buatNamaFile(tahun, bulan) {
  return `Rekap_Absensi_${NAMA_BULAN[bulan - 1]}_${tahun}.xlsx`;
}

export default function AdminArsip({ kembaliKeDashboard }) {
  const sekarang = new Date();
  const [tahun, setTahun] = useState(sekarang.getFullYear());
  const [bulan, setBulan] = useState(sekarang.getMonth() + 1);
  const [preview, setPreview] = useState(null);
  const [arsip, setArsip] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingDaftar, setLoadingDaftar] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingKonfirmasi, setLoadingKonfirmasi] = useState(false);
  const [pesan, setPesan] = useState("");
  const [pesanError, setPesanError] = useState("");
  const [namaFile, setNamaFile] = useState("");
  const [lokasiArsip, setLokasiArsip] = useState("Laptop perusahaan");
  const [laporanGajiSudahDimuat, setLaporanGajiSudahDimuat] = useState(false);

  function kunciLaporanGaji(t, b) {
    return `zaman-teknindo:gaji-laporan-dimuat:v1:${t}-${String(b).padStart(2, "0")}`;
  }

  function cekLaporanGajiSudahDimuat(t, b) {
    try {
      const cacheRaw = sessionStorage.getItem("zaman-teknindo:gaji-laporan-cache:v2");
      if (cacheRaw) {
        const cache = JSON.parse(cacheRaw);
        if (
          cache &&
          Number(cache.tahun) === Number(t) &&
          Number(cache.bulan) === Number(b) &&
          Array.isArray(cache.laporan) &&
          cache.laporan.length > 0
        ) {
          return true;
        }
      }

      // Kompatibilitas dengan penanda versi lama bila masih tersisa.
      return localStorage.getItem(kunciLaporanGaji(t, b)) === "1";
    } catch {
      return false;
    }
  }

  const tahunPilihan = useMemo(() => {
    const hasil = [];
    for (let t = sekarang.getFullYear() - 2; t <= sekarang.getFullYear(); t += 1) {
      hasil.push(t);
    }
    return hasil;
  }, [sekarang.getFullYear()]);

  async function ambilDaftar() {
    setLoadingDaftar(true);
    try {
      const res = await fetch(`${API_URL}/admin/arsip-bulanan`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.pesan || "Gagal memuat arsip bulanan.");
      setArsip(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      setPesanError(error.message || "Gagal memuat arsip bulanan.");
    } finally {
      setLoadingDaftar(false);
    }
  }

  useEffect(() => {
    setLaporanGajiSudahDimuat(cekLaporanGajiSudahDimuat(tahun, bulan));
  }, [tahun, bulan]);

  useEffect(() => {
    void ambilDaftar();
  }, []);

  async function lihatPreview() {
    setLoadingPreview(true);
    setPesan("");
    setPesanError("");
    try {
      const res = await fetch(
        `${API_URL}/admin/arsip-bulanan/${tahun}/${bulan}/preview`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.pesan || "Gagal membuat preview.");
      setPreview(data.data || null);
      setNamaFile(buatNamaFile(tahun, bulan));
    } catch (error) {
      setPreview(null);
      setPesanError(error.message || "Gagal membuat preview.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function exportExcel() {
    setLoadingExport(true);
    setPesan("");
    setPesanError("");

    try {
      const res = await fetch(
        `${API_URL}/admin/gaji/export?tahun=${tahun}&bulan=${bulan}`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );

      if (!res.ok) {
        let data = {};
        try {
          data = await res.json();
        } catch {
          // Response bukan JSON.
        }
        throw new Error(data?.pesan || "Gagal mengunduh Excel.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = namaFile || buatNamaFile(tahun, bulan);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setPesan(
        `File Excel ${namaFile || buatNamaFile(tahun, bulan)} berhasil diunduh. Simpan file tersebut di arsip perusahaan sebelum melakukan konfirmasi cleanup.`,
      );
    } catch (error) {
      console.error("Gagal export Excel:", error);
      setPesanError(error.message || "Gagal mengunduh Excel.");
    } finally {
      setLoadingExport(false);
    }
  }

  async function konfirmasi() {
    if (!preview) return;
    if (!namaFile.trim()) {
      setPesanError("Nama file Excel wajib diisi.");
      return;
    }

    const yakin = window.confirm(
      `Pastikan file Excel ${namaFile} sudah disimpan dengan aman di arsip perusahaan. Setelah dikonfirmasi, cleanup baru boleh berjalan setelah masa tunggu.`,
    );
    if (!yakin) return;

    setLoadingKonfirmasi(true);
    setPesan("");
    setPesanError("");

    try {
      const res = await fetch(
        `${API_URL}/admin/arsip-bulanan/${tahun}/${bulan}/konfirmasi`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            namaFile: namaFile.trim(),
            lokasiArsip: lokasiArsip.trim(),
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.pesan || "Gagal mengonfirmasi periode.");

      setPesan(data.pesan || "Periode berhasil dijadwalkan.");
      await ambilDaftar();
      await lihatPreview();
    } catch (error) {
      setPesanError(error.message || "Gagal mengonfirmasi periode.");
    } finally {
      setLoadingKonfirmasi(false);
    }
  }

  async function batalkan(item) {
    const yakin = window.confirm(
      `Batalkan jadwal cleanup ${NAMA_BULAN[item.bulan - 1]} ${item.tahun}?`,
    );
    if (!yakin) return;

    setPesan("");
    setPesanError("");

    try {
      const res = await fetch(
        `${API_URL}/admin/arsip-bulanan/${item.tahun}/${item.bulan}/batalkan`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.pesan || "Gagal membatalkan jadwal.");

      setPesan(data.pesan || "Jadwal dibatalkan.");
      await ambilDaftar();
    } catch (error) {
      setPesanError(error.message || "Gagal membatalkan jadwal.");
    }
  }

  return (
    <div>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>PENGELOLAAN DATA</p>
          <h2 style={styles.title}>Arsip & Cleanup Absensi</h2>
          <p style={styles.subtitle}>
            Rekap Excel disimpan oleh perusahaan. Setelah dikonfirmasi, data foto
            dan detail absensi dapat dibersihkan otomatis setelah masa tunggu.
          </p>
        </div>

        <div style={styles.headerActions}>
          <div style={styles.securityBadge}>
            <ShieldCheck size={15} /> Cleanup bertahap & terjadwal
          </div>
          {kembaliKeDashboard && (
            <button type="button" onClick={kembaliKeDashboard} style={styles.backButton}>
              Kembali ke Dashboard
            </button>
          )}
        </div>
      </div>

      {(pesan || pesanError) && (
        <div style={pesanError ? styles.error : styles.success}>
          {pesanError ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{pesanError || pesan}</span>
        </div>
      )}

      <div style={styles.grid}>
        <section style={styles.card}>
          <div style={styles.cardHead}>
            <div style={styles.icon}><Archive size={18} /></div>
            <div>
              <h3 style={styles.cardTitle}>Tutup Periode</h3>
              <p style={styles.cardSub}>Preview → Export Excel → simpan → konfirmasi.</p>
            </div>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.label}>
              Tahun
              <select value={tahun} onChange={(e) => setTahun(Number(e.target.value))} style={styles.input}>
                {tahunPilihan.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={styles.label}>
              Bulan
              <select value={bulan} onChange={(e) => setBulan(Number(e.target.value))} style={styles.input}>
                {NAMA_BULAN.map((nama, i) => <option key={nama} value={i + 1}>{nama}</option>)}
              </select>
            </label>
          </div>

          <div style={styles.dataReadyNotice}>
            {laporanGajiSudahDimuat ? (
              <>
                <CheckCircle2 size={15} />
                <span>Laporan gaji periode ini sudah dimuat dari menu Gaji. Export Excel siap digunakan.</span>
              </>
            ) : (
              <>
                <Clock3 size={15} />
                <span>Muat data laporan gaji periode ini terlebih dahulu melalui menu Gaji. Tombol Export Excel akan aktif setelah data berhasil dimuat.</span>
              </>
            )}
          </div>

          <div style={styles.buttonRow}>
            <button type="button" onClick={lihatPreview} style={styles.secondary} disabled={loadingPreview}>
              <Eye size={16} /> {loadingPreview ? "Memuat..." : "Preview Periode"}
            </button>
            <button
              type="button"
              onClick={exportExcel}
              style={styles.primary}
              disabled={loadingExport || !laporanGajiSudahDimuat}
              title={!laporanGajiSudahDimuat ? "Muat data laporan gaji terlebih dahulu melalui menu Gaji." : "Export Excel"}
            >
              <Download size={16} /> {loadingExport ? "Mengunduh..." : "Export Excel"}
            </button>
          </div>

          {preview && (
            <div style={styles.previewBox}>
              <p style={styles.previewTitle}>{NAMA_BULAN[preview.bulan - 1]} {preview.tahun}</p>

              <div style={styles.stats}>
                <div><span>Data Absensi</span><strong>{formatAngka(preview.jumlahAbsensi)}</strong></div>
                <div><span>Foto</span><strong>{formatAngka(preview.jumlahFoto)}</strong></div>
                <div><span>Laporan Gaji</span><strong>{formatAngka(preview.jumlahLaporanGaji)}</strong></div>
              </div>

              <div style={styles.warning}>
                <Clock3 size={15} />
                <span>Setelah dikonfirmasi, cleanup menunggu {preview.masaTungguHari} hari sebelum boleh dijalankan otomatis.</span>
              </div>

              <label style={styles.label}>
                Nama file Excel
                <input value={namaFile} onChange={(e) => setNamaFile(e.target.value)} style={styles.input} />
              </label>

              <label style={styles.label}>
                Lokasi arsip
                <input value={lokasiArsip} onChange={(e) => setLokasiArsip(e.target.value)} style={styles.input} />
              </label>

              <div style={styles.archiveTip}>
                <ShieldCheck size={15} />
                <span>Pastikan Excel benar-benar sudah tersimpan di laptop/perangkat arsip perusahaan sebelum konfirmasi.</span>
              </div>

              <button type="button" onClick={konfirmasi} style={styles.primary} disabled={loadingKonfirmasi}>
                <CheckCircle2 size={16} /> {loadingKonfirmasi ? "Menyimpan..." : "Konfirmasi Arsip & Jadwalkan Cleanup"}
              </button>
            </div>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.cardHead}>
            <div style={styles.icon}><Trash2 size={18} /></div>
            <div>
              <h3 style={styles.cardTitle}>Status Periode</h3>
              <p style={styles.cardSub}>Riwayat periode yang sudah dijadwalkan.</p>
            </div>
          </div>

          {loadingDaftar ? (
            <p style={styles.empty}>Memuat...</p>
          ) : arsip.length === 0 ? (
            <p style={styles.empty}>Belum ada periode yang dijadwalkan.</p>
          ) : (
            <div style={styles.list}>
              {arsip.map((item) => {
                const awal = Number(item.jumlahAbsensiAwal) || 0;
                const dihapus = Number(item.jumlahAbsensiDihapus) || 0;
                const progress = item.status === "selesai" ? 100 : awal > 0 ? (dihapus / awal) * 100 : 0;

                return (
                  <div key={item.id} style={styles.item}>
                    <div style={styles.itemTop}>
                      <div>
                        <strong style={styles.itemTitle}>{NAMA_BULAN[item.bulan - 1]} {item.tahun}</strong>
                        <div style={styles.itemMeta}>{STATUS_LABEL[item.status] || item.status}</div>
                      </div>
                      <span style={styles.status}>{item.status}</span>
                    </div>

                    <div style={styles.progress}>
                      <div style={{ ...styles.progressBar, width: `${Math.min(100, progress)}%` }} />
                    </div>

                    <div style={styles.itemStats}>
                      <span>Absensi: {formatAngka(item.jumlahAbsensiDihapus)} / {formatAngka(item.jumlahAbsensiAwal)}</span>
                      <span>Foto: {formatAngka(item.jumlahFotoDihapus)} / {formatAngka(item.jumlahFotoAwal)}</span>
                    </div>

                    <div style={styles.itemMetaRow}>
                      <span>Arsip: {item.namaFile}</span>
                      <span>Cleanup: {formatTanggal(item.siapDihapusPada)}</span>
                    </div>

                    {item.status === "siap_dihapus" && (
                      <button type="button" onClick={() => batalkan(item)} style={styles.cancel}>
                        <RefreshCcw size={14} /> Batalkan Jadwal
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const styles = {
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" },
  headerActions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  eyebrow: { margin: 0, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.08em", color: warna.aksen },
  title: { margin: "4px 0 3px", fontSize: 20, color: warna.tinta },
  subtitle: { margin: 0, maxWidth: 680, fontSize: 12, lineHeight: 1.55, color: warna.tintaLembut },
  securityBadge: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 999, background: warna.aksenLembut, color: warna.aksen, fontSize: 10.5, fontWeight: 700 },
  backButton: { minHeight: 34, padding: "7px 10px", borderRadius: 9, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tinta, fontSize: 11.5, fontWeight: 650, cursor: "pointer" },
  success: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", marginBottom: 12, borderRadius: 10, background: warna.suksesLembut, color: warna.sukses, fontSize: 12.5 },
  error: { display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", marginBottom: 12, borderRadius: 10, background: warna.bahayaLembut, color: warna.bahaya, fontSize: 12.5 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  card: { background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 12, padding: 18 },
  cardHead: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 },
  icon: { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: warna.aksenLembut, color: warna.aksen, flexShrink: 0 },
  cardTitle: { margin: 0, fontSize: 14.5, color: warna.tinta },
  cardSub: { margin: "3px 0 0", fontSize: 11, color: warna.tintaSamar },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 },
  label: { display: "flex", flexDirection: "column", gap: 5, fontSize: 11.5, color: warna.tintaLembut, fontWeight: 600, marginTop: 9 },
  input: { width: "100%", minHeight: 38, boxSizing: "border-box", padding: "9px 10px", border: `1px solid ${warna.garis}`, borderRadius: 8, fontSize: 12.5, color: warna.tinta, fontFamily: font.display, background: "#fff" },
  buttonRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  primary: { width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 40, padding: "9px 12px", marginTop: 10, background: warna.aksen, color: "#fff", border: "none", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  secondary: { width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 40, padding: "9px 12px", marginTop: 10, background: warna.panelAlt, color: warna.tinta, border: `1px solid ${warna.garis}`, borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  previewBox: { marginTop: 14, padding: 13, background: warna.panelAlt, border: `1px solid ${warna.garis}`, borderRadius: 10 },
  previewTitle: { margin: "0 0 10px", fontSize: 13, fontWeight: 750, color: warna.tinta },
  stats: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 },
  warning: { display: "flex", alignItems: "flex-start", gap: 7, margin: "11px 0 2px", padding: "9px 10px", borderRadius: 8, background: warna.peringatanLembut, color: warna.tintaLembut, fontSize: 10.5, lineHeight: 1.45 },
  archiveTip: { display: "flex", alignItems: "flex-start", gap: 7, marginTop: 10, padding: "9px 10px", borderRadius: 8, background: warna.aksenLembut, color: warna.tintaLembut, fontSize: 10.5, lineHeight: 1.45 },
  empty: { textAlign: "center", color: warna.tintaSamar, fontSize: 12.5 },
  list: { display: "flex", flexDirection: "column", gap: 9 },
  item: { padding: 12, border: `1px solid ${warna.garis}`, borderRadius: 10, background: warna.panelAlt },
  itemTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  itemTitle: { fontSize: 13, color: warna.tinta },
  itemMeta: { marginTop: 2, fontSize: 10.5, color: warna.tintaLembut },
  status: { fontSize: 9.5, fontWeight: 750, padding: "4px 7px", borderRadius: 999, background: warna.panel, color: warna.tintaSamar, border: `1px solid ${warna.garis}`, whiteSpace: "nowrap" },
  progress: { height: 5, marginTop: 9, borderRadius: 999, background: warna.garis, overflow: "hidden" },
  progressBar: { height: "100%", borderRadius: 999, background: warna.aksen },
  itemStats: { display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 8, fontFamily: font.mono, fontSize: 10, color: warna.tintaSamar },
  itemMetaRow: { display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 7, paddingTop: 7, borderTop: `1px solid ${warna.garis}`, fontSize: 10.5, color: warna.tintaSamar },
  cancel: { display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "7px 9px", borderRadius: 8, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tintaLembut, fontSize: 10.5, fontWeight: 650, cursor: "pointer" },
};

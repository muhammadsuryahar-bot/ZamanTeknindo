import { useEffect, useState } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import { Wallet, AlertTriangle, ArrowRight, Info, CheckCircle2, Calendar } from "lucide-react";

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const KUNCI_CACHE_LAPORAN = "zaman-teknindo:gaji-laporan-cache:v2";

function hanyaDigit(teks) {
  return String(teks).replace(/\D/g, "");
}

function formatRibuan(teks) {
  const digit = hanyaDigit(teks);
  return digit ? Number(digit).toLocaleString("id-ID") : "";
}

function bacaCacheLaporan(tahun, bulan) {
  try {
    const cache = JSON.parse(sessionStorage.getItem(KUNCI_CACHE_LAPORAN) || "null");
    if (!cache || Number(cache.tahun) !== Number(tahun) || Number(cache.bulan) !== Number(bulan)) return null;
    return Array.isArray(cache.laporan) ? cache.laporan : null;
  } catch {
    return null;
  }
}

function simpanCacheLaporan(tahun, bulan, laporan) {
  if (!Array.isArray(laporan) || !laporan.length) return;
  try {
    sessionStorage.setItem(KUNCI_CACHE_LAPORAN, JSON.stringify({
      version: 2,
      tahun: Number(tahun),
      bulan: Number(bulan),
      laporan,
      disimpanPada: new Date().toISOString(),
    }));
  } catch (error) {
    console.warn("Cache laporan gaji tidak dapat disimpan:", error);
  }
}

export default function PengaturanGaji() {
  const sekarang = new Date();
  const [daftarGaji, setDaftarGaji] = useState([]);
  const [inputGaji, setInputGaji] = useState({});
  const [loading, setLoading] = useState(true);
  const [pesan, setPesan] = useState("");
  const [sedangSimpanGajiId, setSedangSimpanGajiId] = useState(null);

  const [tahunPilih, setTahunPilih] = useState(sekarang.getFullYear());
  const [bulanPilih, setBulanPilih] = useState(sekarang.getMonth() + 1);
  const [laporanBulanan, setLaporanBulanan] = useState([]);
  const [loadingLaporan, setLoadingLaporan] = useState(false);
  const [sedangHitung, setSedangHitung] = useState(false);
  const [daftarGagal, setDaftarGagal] = useState([]);
  const [laporanDiUjung, setLaporanDiUjung] = useState(false);
  const [statusLaporan, setStatusLaporan] = useState("belum_dimuat");

  const [tahunLibur, setTahunLibur] = useState(sekarang.getFullYear());
  const [daftarHariLibur, setDaftarHariLibur] = useState([]);
  const [formLibur, setFormLibur] = useState({ tanggal: "", keterangan: "" });
  const [pesanLibur, setPesanLibur] = useState("");
  const [sedangSimpanLibur, setSedangSimpanLibur] = useState(false);
  const [hasilImpor, setHasilImpor] = useState(null);
  const [sedangCariImpor, setSedangCariImpor] = useState(false);
  const [sedangSimpanImpor, setSedangSimpanImpor] = useState(false);
  const [pesanImpor, setPesanImpor] = useState("");

  const namaBulanTerpilih = NAMA_BULAN[bulanPilih - 1] || "bulan";

  useEffect(() => { void ambilDataGaji(); }, []);
  useEffect(() => { void ambilHariLibur(); }, [tahunLibur]);
  useEffect(() => {
    const cache = bacaCacheLaporan(tahunPilih, bulanPilih);
    setLaporanBulanan(cache || []);
    setStatusLaporan(cache?.length ? "tersedia" : "belum_dimuat");
    setLaporanDiUjung(false);
    setDaftarGagal([]);
  }, [tahunPilih, bulanPilih]);

  async function bacaJsonAman(res) {
    try { return await res.json(); } catch { return {}; }
  }

  async function ambilDataGaji() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/gaji`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await bacaJsonAman(res);
      if (!res.ok) throw new Error(data.pesan || "Gagal memuat data gaji karyawan.");
      const daftar = Array.isArray(data.data) ? data.data : [];
      setDaftarGaji(daftar);
      const awal = {};
      for (const item of daftar) {
        if (item.gaji?.gajiPokok != null) awal[item.id] = String(Math.round(Number(item.gaji.gajiPokok)));
      }
      setInputGaji(awal);
    } catch (error) {
      console.error(error);
      setPesan(error?.message || "Gagal memuat data gaji.");
    } finally {
      setLoading(false);
    }
  }

  async function simpanGajiPokok(id) {
    if (sedangSimpanGajiId === id) return;
    const angkaGaji = Number(String(inputGaji[id] || "").replace(/\D/g, ""));
    if (!Number.isFinite(angkaGaji) || angkaGaji < 0) {
      setPesan("Gaji pokok harus berupa angka yang valid.");
      return;
    }
    setPesan("");
    setSedangSimpanGajiId(id);
    try {
      const res = await fetch(`${API_URL}/admin/gaji/${id}/atur`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ gajiPokok: angkaGaji }),
      });
      const data = await bacaJsonAman(res);
      if (!res.ok) {
        setPesan(data.pesan || "Gagal menyimpan gaji pokok.");
        return;
      }
      const nilaiTersimpan = data.data?.gajiPokok != null ? Number(data.data.gajiPokok) : angkaGaji;
      setDaftarGaji((lama) => lama.map((item) => item.id === id ? { ...item, gaji: { ...(item.gaji || {}), gajiPokok: nilaiTersimpan, diubahPada: data.data?.diubahPada || item.gaji?.diubahPada } } : item));
      setInputGaji((lama) => ({ ...lama, [id]: String(nilaiTersimpan) }));
      setPesan(data.pesan || "Gaji pokok berhasil disimpan.");
    } catch (error) {
      console.error(error);
      setPesan("Tidak bisa terhubung ke server.");
    } finally {
      setSedangSimpanGajiId(null);
    }
  }

  async function ambilHariLibur() {
    try {
      const res = await fetch(`${API_URL}/admin/hari-libur?tahun=${tahunLibur}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await bacaJsonAman(res);
      if (!res.ok) {
        setDaftarHariLibur([]);
        setPesanLibur(data.pesan || `Gagal memuat kalender ${tahunLibur}.`);
        return;
      }
      setDaftarHariLibur(Array.isArray(data.data) ? data.data : []);
      setPesanLibur("");
    } catch (error) {
      console.error(error);
      setDaftarHariLibur([]);
      setPesanLibur(`Tidak bisa memuat kalender hari libur ${tahunLibur}.`);
    }
  }

  async function tambahHariLibur(event) {
    event.preventDefault();
    if (!formLibur.tanggal) return setPesanLibur("Tanggal wajib diisi.");
    if (!formLibur.keterangan.trim()) return setPesanLibur("Keterangan wajib diisi.");
    if (Number(formLibur.tanggal.slice(0, 4)) !== tahunLibur) return setPesanLibur(`Tanggal harus berada di tahun ${tahunLibur}.`);
    setSedangSimpanLibur(true);
    try {
      const res = await fetch(`${API_URL}/admin/hari-libur`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(formLibur),
      });
      const data = await bacaJsonAman(res);
      if (!res.ok) return setPesanLibur(data.pesan || "Gagal menambahkan hari libur.");
      setFormLibur({ tanggal: "", keterangan: "" });
      await ambilHariLibur();
    } catch (error) {
      console.error(error);
      setPesanLibur("Tidak bisa terhubung ke server.");
    } finally {
      setSedangSimpanLibur(false);
    }
  }

  async function hapusHariLiburKlik(id) {
    try {
      const res = await fetch(`${API_URL}/admin/hari-libur/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` } });
      if (res.ok) await ambilHariLibur();
    } catch (error) {
      console.error(error);
      setPesanLibur("Gagal menghapus hari libur.");
    }
  }

  async function cariUsulanImpor() {
    setSedangCariImpor(true);
    setPesanImpor("");
    setHasilImpor(null);
    try {
      const res = await fetch(`${API_URL}/admin/hari-libur-usulan?tahun=${tahunLibur}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await bacaJsonAman(res);
      if (!res.ok) throw new Error(data.pesan || "Sumber data tidak merespons.");
      const sudahAda = new Set(daftarHariLibur.map((h) => new Date(h.tanggal).toISOString().slice(0, 10)));
      const usulan = (Array.isArray(data.data) ? data.data : [])
        .filter((item) => !sudahAda.has(item.date))
        .map((item) => ({ tanggal: item.date, keterangan: item.description, dipilih: true }));
      setHasilImpor(usulan);
      if (!usulan.length) setPesanImpor(data.data?.length ? `Semua hari libur ${tahunLibur} sudah terdaftar.` : `Tidak ada data hari libur ${tahunLibur} dari sumber publik.`);
    } catch (error) {
      console.error(error);
      setPesanImpor("Tidak bisa mengambil kalender dari sumber publik. Silakan tambahkan manual.");
      setHasilImpor([]);
    } finally {
      setSedangCariImpor(false);
    }
  }

  function toggleUsulanImpor(index) {
    setHasilImpor((lama) => (lama || []).map((u, i) => i === index ? { ...u, dipilih: !u.dipilih } : u));
  }

  async function simpanUsulanTerpilih() {
    const terpilih = (hasilImpor || []).filter((u) => u.dipilih);
    if (!terpilih.length) return;
    setSedangSimpanImpor(true);
    let berhasil = 0;
    for (const item of terpilih) {
      try {
        const res = await fetch(`${API_URL}/admin/hari-libur`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ tanggal: item.tanggal, keterangan: item.keterangan }),
        });
        if (res.ok) berhasil += 1;
      } catch (error) { console.error(error); }
    }
    setSedangSimpanImpor(false);
    setHasilImpor(null);
    setPesanImpor(`${berhasil} hari libur berhasil ditambahkan.`);
    await ambilHariLibur();
  }

  async function muatLaporanBulanan() {
    const cache = bacaCacheLaporan(tahunPilih, bulanPilih);
    if (cache?.length) {
      setLaporanBulanan(cache);
      setStatusLaporan("tersedia");
      setPesan(`Laporan gaji ${namaBulanTerpilih} ${tahunPilih} sudah dimuat sebelumnya.`);
      return;
    }
    setLoadingLaporan(true);
    setStatusLaporan("memuat");
    setPesan("");
    try {
      const res = await fetch(`${API_URL}/admin/gaji/laporan?tahun=${tahunPilih}&bulan=${bulanPilih}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await bacaJsonAman(res);
      if (!res.ok) {
        setStatusLaporan("error");
        setPesan(data.pesan || `Gagal memuat laporan gaji ${namaBulanTerpilih} ${tahunPilih}.`);
        return;
      }
      const hasil = Array.isArray(data.data) ? data.data : [];
      setLaporanBulanan(hasil);
      setStatusLaporan(hasil.length ? "tersedia" : "kosong");
      if (hasil.length) {
        simpanCacheLaporan(tahunPilih, bulanPilih, hasil);
        setPesan(`Laporan gaji ${namaBulanTerpilih} ${tahunPilih} sudah dimuat.`);
      }
    } catch (error) {
      console.error(error);
      setStatusLaporan("error");
      setPesan("Tidak bisa terhubung ke server saat memuat laporan gaji.");
    } finally {
      setLoadingLaporan(false);
    }
  }

  async function hitungSemuaGaji() {
    setSedangHitung(true);
    setPesan("");
    setDaftarGagal([]);
    setStatusLaporan("belum_dimuat");
    setLaporanBulanan([]);
    try {
      const res = await fetch(`${API_URL}/admin/gaji/hitung-semua?tahun=${tahunPilih}&bulan=${bulanPilih}`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await bacaJsonAman(res);
      if (!res.ok) {
        setPesan(data.pesan || `Gagal menghitung gaji ${namaBulanTerpilih} ${tahunPilih}.`);
        return;
      }
      setPesan(data.pesan || `Perhitungan gaji ${namaBulanTerpilih} ${tahunPilih} selesai.`);
      setDaftarGagal(Array.isArray(data.gagal) ? data.gagal : []);
      await muatLaporanBulanan();
    } catch (error) {
      console.error(error);
      setPesan("Tidak bisa terhubung ke server saat menghitung gaji.");
    } finally {
      setSedangHitung(false);
    }
  }

  function formatRupiah(angka) { return `Rp ${Number(angka || 0).toLocaleString("id-ID")}`; }
  function formatTanggalLibur(tanggal) { return new Date(tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }); }

  if (loading) return <div style={styles.empty}>Memuat data gaji…</div>;

  return (
    <div style={styles.wrap}>
      {pesan && <div role="status" aria-live="polite" style={styles.toast}><span style={styles.toastIcon}>✓</span><span>{pesan}</span></div>}

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div><h2 style={styles.title}>Gaji Pokok</h2><p style={styles.sub}>Atur gaji pokok masing-masing karyawan. Aturan potongan dan jam masuk dikelola di Pengaturan.</p></div>
        </div>
        {daftarGaji.length === 0 ? <div style={styles.emptyBox}><Wallet size={26} /><p>Belum ada karyawan aktif untuk diatur gajinya.</p></div> : daftarGaji.map((item) => (
          <div key={item.id} style={styles.salaryRow}>
            <div style={{ minWidth: 0, flex: 1 }}><strong>{item.nama}</strong><p style={styles.meta}>{item.jabatan || "-"} · {item.divisi || "-"}</p></div>
            <div style={styles.salaryAction}><div style={styles.rupiah}><span>Rp</span><input type="text" inputMode="numeric" placeholder="Belum diatur" value={formatRibuan(inputGaji[item.id] ?? "")} onChange={(e) => setInputGaji((lama) => ({ ...lama, [item.id]: hanyaDigit(e.target.value) }))} /></div><button type="button" onClick={() => void simpanGajiPokok(item.id)} style={styles.primary} disabled={sedangSimpanGajiId === item.id}>{sedangSimpanGajiId === item.id ? "…" : "Simpan"}</button></div>
          </div>
        ))}
      </section>

      <section style={styles.card}>
        <div><h2 style={styles.title}>Hari Libur</h2><p style={styles.sub}>Kalender hari libur menentukan tanggal yang tidak dihitung sebagai Alpha.</p></div>
        <form onSubmit={tambahHariLibur} style={styles.holidayForm}>
          <input type="date" value={formLibur.tanggal} min={`${tahunLibur}-01-01`} max={`${tahunLibur}-12-31`} onChange={(e) => setFormLibur((lama) => ({ ...lama, tanggal: e.target.value }))} style={styles.input} />
          <input type="text" placeholder="Contoh: Hari Kemerdekaan" value={formLibur.keterangan} onChange={(e) => setFormLibur((lama) => ({ ...lama, keterangan: e.target.value }))} style={styles.input} />
          <button type="submit" style={styles.primary} disabled={sedangSimpanLibur}>{sedangSimpanLibur ? "Menyimpan…" : "Tambah"}</button>
        </form>
        {pesanLibur && <p style={styles.error}>{pesanLibur}</p>}
        <div style={styles.yearRow}><span>Kalender:</span><button type="button" onClick={() => setTahunLibur((t) => Math.max(2020, t - 1))} style={styles.stepper}>−</button><input type="number" min="2020" max="2100" value={tahunLibur} onChange={(e) => setTahunLibur(Math.min(2100, Math.max(2020, Number(e.target.value) || sekarang.getFullYear())))} style={styles.yearInput} /><button type="button" onClick={() => setTahunLibur((t) => Math.min(2100, t + 1))} style={styles.stepper}>+</button></div>
        <div style={styles.infoBox}><Calendar size={15} /><span>{daftarHariLibur.length ? `Kalender ${tahunLibur} tersimpan dengan ${daftarHariLibur.length} hari libur.` : `Belum ada data hari libur untuk ${tahunLibur}.`}</span></div>
        <button type="button" onClick={() => void cariUsulanImpor()} style={styles.secondaryWide} disabled={sedangCariImpor}>{sedangCariImpor ? "Mencari…" : `Impor Otomatis Kalender ${tahunLibur}`}</button>
        {pesanImpor && <p style={styles.error}>{pesanImpor}</p>}
        {Array.isArray(hasilImpor) && hasilImpor.length > 0 && <div style={styles.importBox}><p style={styles.sub}>Pilih usulan yang ingin disimpan. Belum tersimpan sebelum dikonfirmasi.</p>{hasilImpor.map((item, index) => <label key={item.tanggal} style={styles.importRow}><input type="checkbox" checked={item.dipilih} onChange={() => toggleUsulanImpor(index)} /><span>{formatTanggalLibur(item.tanggal)}</span><span style={{ flex: 1 }}>{item.keterangan}</span></label>)}<div style={styles.buttonRow}><button type="button" onClick={() => void simpanUsulanTerpilih()} style={styles.primary} disabled={sedangSimpanImpor}>{sedangSimpanImpor ? "Menyimpan…" : `Impor ${hasilImpor.filter((x) => x.dipilih).length} Terpilih`}</button><button type="button" onClick={() => setHasilImpor(null)} style={styles.secondary}>Batal</button></div></div>}
        <div style={{ marginTop: 12 }}>{daftarHariLibur.map((item) => <div key={item.id} style={styles.holidayRow}><span style={styles.date}>{formatTanggalLibur(item.tanggal)}</span><span style={{ flex: 1 }}>{item.keterangan}</span><button type="button" onClick={() => void hapusHariLiburKlik(item.id)} style={styles.delete}>Hapus</button></div>)}</div>
      </section>

      <section style={styles.card}>
        <div><h2 style={styles.title}>Laporan Gaji Bulanan</h2><p style={styles.sub}>Pilih periode untuk menghitung atau melihat laporan gaji yang sudah tersimpan.</p></div>
        <div style={styles.periodRow}><select value={bulanPilih} onChange={(e) => setBulanPilih(Number(e.target.value))} style={styles.input}>{NAMA_BULAN.map((nama, i) => <option key={nama} value={i + 1}>{nama}</option>)}</select><input type="number" min="2020" max="2100" value={tahunPilih} onChange={(e) => setTahunPilih(Math.min(2100, Math.max(2020, Number(e.target.value) || sekarang.getFullYear())))} style={styles.inputYear} /></div>
        <div style={styles.buttonRow}><button type="button" onClick={() => void hitungSemuaGaji()} style={styles.primary} disabled={sedangHitung}>{sedangHitung ? "Menghitung…" : "Hitung Gaji Bulan Ini"}</button><button type="button" onClick={() => void muatLaporanBulanan()} style={styles.secondary} disabled={loadingLaporan}>{loadingLaporan ? "Memuat…" : "Muat Data yang Sudah Ada"}</button></div>
        {statusLaporan === "kosong" && <div style={styles.infoBox}><Info size={17} /><span>Belum ada laporan gaji untuk {namaBulanTerpilih} {tahunPilih}.</span></div>}
        {statusLaporan === "tersedia" && <div style={styles.successBox}><CheckCircle2 size={17} /><span>Laporan {namaBulanTerpilih} {tahunPilih} tersedia dengan {laporanBulanan.length} data karyawan.</span></div>}
        {statusLaporan === "belum_dimuat" && <div style={styles.infoBox}><Info size={17} /><span>Belum memuat laporan periode ini.</span></div>}
        {statusLaporan === "error" && <div style={styles.errorBox}><AlertTriangle size={17} /><span>Laporan gagal dimuat. Coba ulangi.</span></div>}
        {daftarGagal.length > 0 && <div style={styles.warningBox}><strong><AlertTriangle size={14} /> {daftarGagal.length} karyawan tidak ikut dihitung:</strong><ul>{daftarGagal.map((item, i) => <li key={i}>{item.nama} — {item.alasan}</li>)}</ul></div>}
        {statusLaporan === "tersedia" && <>
          <p style={styles.scrollHint}><ArrowRight size={13} /> Geser tabel ke kanan di HP untuk melihat semua kolom.</p>
          <div style={styles.tableWrap} onScroll={(e) => setLaporanDiUjung(e.currentTarget.scrollLeft + e.currentTarget.clientWidth >= e.currentTarget.scrollWidth - 4)}><table style={styles.table}><thead><tr><th style={styles.th}>Nama</th><th style={styles.th}>Tepat Waktu</th><th style={styles.th}>Telat</th><th style={styles.th}>Alpha</th><th style={styles.th}>Potongan</th><th style={styles.th}>Gaji Diterima</th></tr></thead><tbody>{laporanBulanan.map((item) => <tr key={item.id}><td style={styles.tdSticky}>{item.pengguna?.nama || "-"}</td><td style={styles.tdCenter}>{item.jumlahTepatWaktu ?? 0}</td><td style={styles.tdCenter}>{item.jumlahTelat ?? 0}</td><td style={styles.tdCenter}>{item.jumlahAlpha ?? 0}</td><td style={styles.tdMoney}>{formatRupiah(item.totalPotongan)}</td><td style={styles.tdMoney}>{formatRupiah(item.gajiDiterima)}</td></tr>)}</tbody></table></div>{!laporanDiUjung && <div style={styles.fade}><span /></div>}
        </>}
      </section>
    </div>
  );
}

const styles = {
  wrap: { display: "grid", gap: 14 },
  card: { background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 14, padding: 20, boxSizing: "border-box" },
  sectionHeader: { marginBottom: 4 },
  title: { margin: 0, fontSize: 17, fontWeight: 800, color: warna.tinta, fontFamily: font.display },
  sub: { margin: "5px 0 16px", color: warna.tintaLembut, fontSize: 12.5, lineHeight: 1.5 },
  salaryRow: { display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderTop: `1px solid ${warna.garis}`, flexWrap: "wrap" },
  salaryAction: { display: "flex", alignItems: "center", gap: 8, width: "min(100%, 360px)" },
  rupiah: { display: "flex", alignItems: "center", flex: 1, minWidth: 0, border: `1px solid ${warna.garis}`, borderRadius: 9, overflow: "hidden", background: warna.panelAlt },
  rupiah: { display: "flex", alignItems: "center", flex: 1, minWidth: 0, border: `1px solid ${warna.garis}`, borderRadius: 9, overflow: "hidden", background: warna.panelAlt },
  primary: { minHeight: 40, padding: "0 14px", border: 0, borderRadius: 9, background: warna.aksen, color: "#fff", fontWeight: 750, cursor: "pointer", whiteSpace: "nowrap" },
  secondary: { minHeight: 40, padding: "0 14px", border: `1px solid ${warna.garis}`, borderRadius: 9, background: warna.panel, color: warna.tinta, fontWeight: 700, cursor: "pointer" },
  secondaryWide: { width: "100%", minHeight: 40, padding: "0 14px", border: `1px dashed ${warna.garis}`, borderRadius: 9, background: warna.panelAlt, color: warna.tinta, fontWeight: 700, cursor: "pointer" },
  input: { flex: 1, minHeight: 40, padding: "0 10px", border: `1px solid ${warna.garis}`, borderRadius: 9, background: warna.panel, color: warna.tinta, fontFamily: font.display },
  inputYear: { width: 120, minHeight: 40, padding: "0 10px", border: `1px solid ${warna.garis}`, borderRadius: 9, background: warna.panel, color: warna.tinta, fontFamily: font.mono },
  yearInput: { width: 76, height: 30, border: `1px solid ${warna.garis}`, borderRadius: 8, textAlign: "center", background: warna.panel, color: warna.tinta, fontFamily: font.mono },
  stepper: { width: 30, height: 30, borderRadius: 8, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tinta, cursor: "pointer" },
  yearRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 },
  holidayForm: { display: "flex", gap: 8, flexWrap: "wrap" },
  infoBox: { display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, padding: "10px 12px", borderRadius: 9, background: warna.panelAlt, color: warna.tintaLembut, fontSize: 12 },
  successBox: { display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, padding: "10px 12px", borderRadius: 9, background: warna.aksenLembut, color: warna.aksen, fontSize: 12 },
  errorBox: { display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, padding: "10px 12px", borderRadius: 9, background: warna.bahayaLembut, color: warna.bahaya, fontSize: 12 },
  warningBox: { marginTop: 12, padding: 12, borderRadius: 9, background: warna.peringatanLembut, color: warna.tinta, fontSize: 12 },
  importBox: { marginTop: 12, padding: 12, border: `1px solid ${warna.garis}`, borderRadius: 10 },
  importRow: { display: "flex", gap: 9, alignItems: "center", padding: "6px 0", fontSize: 12.5 },
  buttonRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 },
  holidayRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${warna.garis}`, fontSize: 12.5 },
  date: { width: 125, flexShrink: 0, fontFamily: font.mono, fontWeight: 650 },
  delete: { border: 0, background: "transparent", color: warna.bahaya, cursor: "pointer", fontWeight: 700 },
  periodRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  scrollHint: { display: "flex", alignItems: "center", gap: 4, margin: "12px 0 6px", color: warna.tintaSamar, fontSize: 11.5 },
  tableWrap: { overflowX: "auto", border: `1px solid ${warna.garis}`, borderRadius: 10 },
  table: { width: "100%", minWidth: 680, borderCollapse: "collapse", fontSize: 12 },
  th: { padding: "10px 12px", background: warna.panelAlt, borderBottom: `1px solid ${warna.garis}`, textAlign: "left", whiteSpace: "nowrap", color: warna.tintaLembut },
  tdSticky: { padding: "11px 12px", borderBottom: `1px solid ${warna.garis}`, position: "sticky", left: 0, background: warna.panel, boxShadow: `1px 0 0 ${warna.garis}`, whiteSpace: "nowrap" },
  tdCenter: { padding: "11px 12px", borderBottom: `1px solid ${warna.garis}`, textAlign: "center", whiteSpace: "nowrap" },
  tdMoney: { padding: "11px 12px", borderBottom: `1px solid ${warna.garis}`, fontFamily: font.mono, whiteSpace: "nowrap" },
  fade: { height: 0 },
  toast: { position: "fixed", top: 18, right: 18, zIndex: 9999, width: "min(390px, calc(100vw - 36px))", display: "flex", gap: 9, padding: "11px 13px", borderRadius: 10, background: warna.panel, border: `1px solid ${warna.garis}`, boxShadow: "0 15px 35px rgba(15,23,42,.12)", color: warna.tinta, fontSize: 12.5 },
  toastIcon: { width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", background: warna.aksenLembut, color: warna.aksen, fontWeight: 800, flexShrink: 0 },
  empty: { padding: 30, textAlign: "center", color: warna.tintaSamar },
  emptyBox: { padding: 20, border: `1px dashed ${warna.garis}`, borderRadius: 10, textAlign: "center", color: warna.tintaSamar },
  error: { margin: "8px 0 0", color: warna.bahaya, fontSize: 12 },
};
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileEdit,
  FileText,
  LogOut,
  Navigation,
  RefreshCcw,
  Save,
  Settings,
  Shield,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import logoHorizontal from "../assets/logo-horizontal.png";
import logo from "../assets/logo.png";
import AdminIzin from "./AdminIzin";
import PengaturanGaji from "./PengaturanGaji";
import AdminGajiMassal from "./AdminGajiMassal";
import { labelStatusKehadiran } from "../utils/statusKehadiran";

const TAB_VALID = ["rekap", "approval", "karyawan", "izin", "gaji", "gaji-massal", "kantor", "pengaturan"];
const JAM_DEFAULT = "08:10";

function getSavedTab() {
  try {
    const value = sessionStorage.getItem("admin-tab");
    return TAB_VALID.includes(value) ? value : "rekap";
  } catch {
    return "rekap";
  }
}

function formatTanggal(tanggal) {
  if (!tanggal) return "–";
  return new Date(tanggal).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" });
}

function formatJam(tanggal) {
  if (!tanggal) return "–";
  return new Date(tanggal).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
}

function inisialNama(nama) {
  if (!nama) return "?";
  const bagian = String(nama).trim().split(/\s+/);
  if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
  return `${bagian[0][0]}${bagian[bagian.length - 1][0]}`.toUpperCase();
}

export default function DashboardAdmin({ pengguna, onLogout, tanggalRekap, rekapRefreshNonce }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState(getSavedTab);
  const [sidebarMobile, setSidebarMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pesan, setPesan] = useState("");
  const [sukses, setSukses] = useState("");

  const [rekap, setRekap] = useState([]);
  const [belumAbsen, setBelumAbsen] = useState([]);
  const [jumlahAktif, setJumlahAktif] = useState(0);
  const [menunggu, setMenunggu] = useState([]);
  const [notifikasi, setNotifikasi] = useState({ akunBaru: 0, izinBaru: 0, total: 0 });
  const [pencarian, setPencarian] = useState("");
  const [belumAbsenBuka, setBelumAbsenBuka] = useState(false);
  const [notifBuka, setNotifBuka] = useState(false);

  const [karyawan, setKaryawan] = useState([]);
  const [kantor, setKantor] = useState([]);
  const [loadingKaryawan, setLoadingKaryawan] = useState(false);
  const [loadingKantor, setLoadingKantor] = useState(false);

  const [formAktivasiId, setFormAktivasiId] = useState(null);
  const [formAktivasi, setFormAktivasi] = useState({ jabatan: "", divisi: "", kantorId: "" });

  const [formEditKaryawanId, setFormEditKaryawanId] = useState(null);
  const [formEditKaryawan, setFormEditKaryawan] = useState({ email: "", jabatan: "", divisi: "", kantorId: "" });
  const [resetPassword, setResetPassword] = useState(null);
  const [konfirmasiNonaktif, setKonfirmasiNonaktif] = useState(null);

  const [formKantor, setFormKantor] = useState({ namaKantor: "", alamat: "", latitude: "", longitude: "" });
  const [kantorEditId, setKantorEditId] = useState(null);
  const [simpanKantorLoading, setSimpanKantorLoading] = useState(false);

  const [jamMasukStandar, setJamMasukStandar] = useState(JAM_DEFAULT);
  const [potongan, setPotongan] = useState({ potonganTelat: 10000, potonganAlpha: 15000 });
  const [simpanAturanLoading, setSimpanAturanLoading] = useState(false);
  const [kepadatan, setKepadatan] = useState(() => {
    try { return localStorage.getItem("zaman-admin-density") || "normal"; } catch { return "normal"; }
  });
  const [tampilkanFoto, setTampilkanFoto] = useState(() => {
    try { return localStorage.getItem("zaman-admin-show-photos") !== "false"; } catch { return true; }
  });

  useEffect(() => {
    try { sessionStorage.setItem("admin-tab", tab); } catch { /* abaikan */ }
    setSidebarMobile(false);
    setPesan("");
    setSukses("");
  }, [tab]);

  useEffect(() => {
    void muatDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggalRekap, rekapRefreshNonce]);

  useEffect(() => {
    if (tab === "karyawan") void muatKaryawan();
    if (tab === "kantor" || tab === "pengaturan" || tab === "approval") void muatKantor();
    if (tab === "pengaturan") void muatAturan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void muatNotifikasi();
      if (tab === "rekap" || tab === "approval") void muatDashboard({ silent: true });
      if (tab === "karyawan") void muatKaryawan({ silent: true, force: true });
      if (tab === "kantor") void muatKantor({ silent: true });
    }, 15000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tanggalRekap]);

  useEffect(() => {
    if (!pesan && !sukses) return;
    const timer = window.setTimeout(() => { setPesan(""); setSukses(""); }, 5000);
    return () => window.clearTimeout(timer);
  }, [pesan, sukses]);

  async function fetchJson(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${getToken()}`, ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.pesan || "Permintaan gagal diproses.");
    return data;
  }

  async function muatDashboard({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const rekapPath = tanggalRekap ? `/admin/rekap-tanggal?tanggal=${encodeURIComponent(tanggalRekap)}` : "/admin/rekap-hari-ini";
      const [dataRekap, dataMenunggu] = await Promise.all([fetchJson(rekapPath), fetchJson("/admin/akun-menunggu")]);
      if (!Array.isArray(dataRekap.data) || !Array.isArray(dataMenunggu.data)) throw new Error("Format data dashboard tidak valid.");
      setRekap(dataRekap.data);
      setBelumAbsen(Array.isArray(dataRekap.belumAbsen) ? dataRekap.belumAbsen : []);
      setJumlahAktif(Number(dataRekap.jumlahKaryawanAktif) || 0);
      setMenunggu(dataMenunggu.data);
      void muatNotifikasi();
    } catch (error) {
      console.error("Gagal memuat dashboard Admin:", error);
      if (!silent) setPesan(error?.message || "Gagal memuat dashboard.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function muatNotifikasi() {
    try {
      const data = await fetchJson("/admin/notifikasi");
      if (data?.data) setNotifikasi({ akunBaru: Number(data.data.akunBaru) || 0, izinBaru: Number(data.data.izinBaru) || 0, total: Number(data.data.total) || 0 });
    } catch (error) { console.warn("Notifikasi Admin gagal dimuat:", error); }
  }

  async function muatKaryawan({ silent = false, force = false } = {}) {
    if (!force && karyawan.length > 0) return;
    if (!silent) setLoadingKaryawan(true);
    try {
      const data = await fetchJson("/admin/karyawan");
      setKaryawan(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error(error);
      if (!silent) setPesan(error?.message || "Gagal memuat karyawan.");
    } finally { if (!silent) setLoadingKaryawan(false); }
  }

  async function muatKantor({ silent = false } = {}) {
    if (!silent) setLoadingKantor(true);
    try {
      const data = await fetchJson("/admin/kantor");
      setKantor(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error(error);
      if (!silent) setPesan(error?.message || "Gagal memuat data kantor.");
    } finally { if (!silent) setLoadingKantor(false); }
  }

  async function muatAturan() {
    try {
      const data = await fetchJson("/admin/pengaturan-potongan");
      const jam = String(data?.data?.jamMasukStandar || JAM_DEFAULT);
      setJamMasukStandar(jam.slice(0, 5));
      setPotongan({ potonganTelat: Number(data?.data?.potonganTelat) || 0, potonganAlpha: Number(data?.data?.potonganAlpha) || 0 });
    } catch (error) { console.error(error); setPesan(error?.message || "Gagal memuat aturan absensi."); }
  }

  async function simpanAturan() {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(jamMasukStandar)) { setPesan("Jam masuk standar harus dalam format HH:MM."); return; }
    setSimpanAturanLoading(true);
    try {
      const data = await fetchJson("/admin/pengaturan-potongan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jamMasukStandar, potonganTelat: Number(potongan.potonganTelat) || 0, potonganAlpha: Number(potongan.potonganAlpha) || 0 }),
      });
      setJamMasukStandar(String(data?.data?.jamMasukStandar || jamMasukStandar).slice(0, 5));
      setSukses(data?.pesan || "Aturan absensi berhasil disimpan.");
    } catch (error) { console.error(error); setPesan(error?.message || "Gagal menyimpan aturan absensi."); }
    finally { setSimpanAturanLoading(false); }
  }

  async function bukaFormAktivasi(item) {
    await muatKantor({ silent: true });
    setFormAktivasiId(item.id);
    setFormAktivasi({ jabatan: "", divisi: "", kantorId: "" });
  }

  async function kirimAktivasi(id) {
    if (!formAktivasi.jabatan.trim() || !formAktivasi.divisi.trim()) { setPesan("Jabatan dan divisi wajib diisi."); return; }
    if (!formAktivasi.kantorId) { setPesan("Homebase karyawan wajib dipilih. Sistem tidak akan memilih kantor secara otomatis."); return; }
    try {
      const data = await fetchJson(`/admin/akun/${id}/aktifkan`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formAktivasi) });
      setSukses(data?.pesan || "Akun berhasil diaktifkan.");
      setFormAktivasiId(null);
      setMenunggu((items) => items.filter((item) => item.id !== id));
      setJumlahAktif((value) => value + 1);
      void muatNotifikasi();
      void muatKaryawan({ force: true, silent: true });
    } catch (error) { console.error(error); setPesan(error?.message || "Gagal mengaktifkan akun."); }
  }

  function bukaEditKaryawan(item) {
    setFormEditKaryawanId(item.id);
    setFormEditKaryawan({ email: item.email || "", jabatan: item.jabatan || "", divisi: item.divisi || "", kantorId: item.kantorId ? String(item.kantorId) : "" });
  }

  async function simpanEditKaryawan() {
    if (!formEditKaryawan.jabatan.trim()) { setPesan("Jabatan wajib diisi."); return; }
    try {
      const data = await fetchJson(`/admin/karyawan/${formEditKaryawanId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formEditKaryawan) });
      setSukses(data?.pesan || "Data karyawan berhasil diperbarui.");
      setFormEditKaryawanId(null);
      await muatKaryawan({ force: true, silent: true });
      await muatDashboard({ silent: true });
    } catch (error) { console.error(error); setPesan(error?.message || "Gagal memperbarui data karyawan."); }
  }

  async function ubahStatusKaryawan(id, statusAkun) {
    try {
      const data = await fetchJson(`/admin/karyawan/${id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statusAkun }) });
      setSukses(data?.pesan || "Status karyawan diperbarui.");
      setKonfirmasiNonaktif(null);
      await muatKaryawan({ force: true, silent: true });
      await muatDashboard({ silent: true });
    } catch (error) { console.error(error); setPesan(error?.message || "Gagal mengubah status karyawan."); }
  }

  async function resetPasswordKaryawan(id) {
    try {
      const data = await fetchJson(`/admin/karyawan/${id}/reset-password`, { method: "PUT" });
      setResetPassword({ id, password: data.passwordSementara });
      setSukses("Password sementara berhasil dibuat. Password hanya ditampilkan sekali.");
    } catch (error) { console.error(error); setPesan(error?.message || "Gagal mereset password."); }
  }

  function bukaFormTambahKantor() {
    setKantorEditId(null);
    setFormKantor({ namaKantor: "", alamat: "", latitude: "", longitude: "" });
  }

  function bukaFormEditKantor(item) {
    setKantorEditId(item.id);
    setFormKantor({ namaKantor: item.namaKantor || "", alamat: item.alamat || "", latitude: item.latitude ?? "", longitude: item.longitude ?? "" });
  }

  async function gunakanLokasiSekarang() {
    if (!navigator.geolocation) { setPesan("Perangkat/browser ini tidak menyediakan GPS."); return; }
    navigator.geolocation.getCurrentPosition(
      (posisi) => {
        setFormKantor((lama) => ({ ...lama, latitude: Number(posisi.coords.latitude).toFixed(7), longitude: Number(posisi.coords.longitude).toFixed(7) }));
        setSukses("Koordinat lokasi saat ini berhasil diambil. Tekan Simpan.");
      },
      (error) => { console.warn("GPS Admin gagal:", error); setPesan("Lokasi belum berhasil diperoleh. Pastikan GPS dan izin lokasi aktif."); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }

  async function simpanKantor() {
    if (!formKantor.namaKantor.trim()) { setPesan("Nama kantor wajib diisi."); return; }
    const latDiisi = String(formKantor.latitude).trim() !== "";
    const lngDiisi = String(formKantor.longitude).trim() !== "";
    if ((latDiisi && !Number.isFinite(Number(formKantor.latitude))) || (lngDiisi && !Number.isFinite(Number(formKantor.longitude)))) { setPesan("Latitude dan longitude harus berupa angka."); return; }
    if ((latDiisi && !lngDiisi) || (!latDiisi && lngDiisi)) { setPesan("Latitude dan longitude harus diisi berpasangan."); return; }
    setSimpanKantorLoading(true);
    try {
      const url = kantorEditId ? `/admin/kantor/${kantorEditId}` : "/admin/kantor";
      const data = await fetchJson(url, { method: kantorEditId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formKantor) });
      setSukses(data?.pesan || "Data kantor berhasil disimpan.");
      bukaFormTambahKantor();
      await muatKantor({ silent: true });
      await muatKaryawan({ force: true, silent: true });
    } catch (error) { console.error(error); setPesan(error?.message || "Gagal menyimpan data kantor."); }
    finally { setSimpanKantorLoading(false); }
  }

  const rekapTersaring = useMemo(() => {
    const q = pencarian.trim().toLowerCase();
    if (!q) return rekap;
    return rekap.filter((item) => `${item.pengguna?.nama || ""} ${item.pengguna?.jabatan || ""} ${item.pengguna?.divisi || ""}`.toLowerCase().includes(q));
  }, [rekap, pencarian]);

  const karyawanTersaring = useMemo(() => {
    const q = pencarian.trim().toLowerCase();
    if (!q) return karyawan;
    return karyawan.filter((item) => `${item.nama || ""} ${item.email || ""} ${item.jabatan || ""} ${item.divisi || ""} ${item.kantor?.namaKantor || ""}`.toLowerCase().includes(q));
  }, [karyawan, pencarian]);

  const jumlahTepatWaktu = rekap.filter((item) => (item.statusFinal || item.statusOtomatis) === "tepat_waktu").length;
  const jumlahTelat = rekap.filter((item) => (item.statusFinal || item.statusOtomatis) === "telat").length;
  const jumlahIzin = rekap.filter((item) => ["izin", "sakit", "cuti", "urgent"].includes(item.statusFinal || item.statusOtomatis)).length;

  const tabs = [
    ["rekap", "Rekap Hari Ini", ClipboardList],
    ["approval", "Menunggu", UserPlus],
    ["karyawan", "Karyawan", Users],
    ["izin", "Izin", FileEdit],
    ["gaji", "Gaji", Wallet],
    ["gaji-massal", "Gaji Massal", Wallet],
    ["kantor", "Kantor & Homebase", Building2],
    ["pengaturan", "Pengaturan", Settings],
  ];

  const groups = [
    ["WORKSPACE", ["rekap", "approval"]],
    ["PEOPLE", ["karyawan", "izin"]],
    ["FINANCE", ["gaji", "gaji-massal"]],
    ["SYSTEM", ["kantor", "pengaturan"]],
  ];

  function judulTab() { return tabs.find(([id]) => id === tab)?.[1] || "Dashboard Admin"; }
  function pilihTab(id) { setTab(id); setPencarian(""); setNotifBuka(false); }

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar} className={sidebarMobile ? "admin-sidebar sidebar-mobile-terbuka" : "admin-sidebar"}>
        <div style={styles.logoWrap}><img src={logoHorizontal} alt="PT. Zaman Teknindo" style={styles.logo} /></div>
        <nav style={styles.nav}>
          {groups.map(([group, ids]) => <div key={group}><div style={styles.groupTitle}>{group}</div>{ids.map((id) => { const item = tabs.find(([x]) => x === id); if (!item) return null; const Icon = item[2]; const badge = id === "approval" ? menunggu.length : id === "izin" ? notifikasi.izinBaru : 0; return <button key={id} type="button" onClick={() => pilihTab(id)} style={tab === id ? styles.navActive : styles.navItem}><Icon size={17} /><span style={{ flex: 1, textAlign: "left" }}>{item[1]}</span>{badge > 0 && <span style={styles.badge}>{badge > 99 ? "99+" : badge}</span>}</button>; })}</div>)}
        </nav>
        <div style={styles.sidebarBottom}><div style={styles.profileRow}><div style={styles.avatar}>{inisialNama(pengguna?.nama)}</div><div style={{ minWidth: 0 }}><strong style={styles.profileName}>{pengguna?.nama || "Admin"}</strong><span style={styles.profileRole}>Admin</span></div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><button type="button" onClick={() => navigate("/ganti-password")} style={styles.smallButton}>Password</button><button type="button" onClick={onLogout} style={{ ...styles.smallButton, color: warna.bahaya }}><LogOut size={13} /> Keluar</button></div></div>
      </aside>
      {sidebarMobile && <div style={styles.mobileOverlay} onClick={() => setSidebarMobile(false)} />}

      <main style={styles.main} className="main-area-admin">
        <div style={styles.mobileBar}><button type="button" onClick={() => setSidebarMobile(true)} style={styles.iconButton} aria-label="Buka menu"><BarChart3 size={18} /></button><img src={logo} alt="PT. Zaman Teknindo" style={{ height: 28 }} /><div style={{ width: 36 }} /></div>
        <header style={styles.header}><div><h1 style={styles.title}>{judulTab()}</h1><p style={styles.subtitle}>{formatTanggal(tanggalRekap || new Date())}</p></div><div style={{ position: "relative" }}><button type="button" onClick={() => setNotifBuka((v) => !v)} style={styles.iconButton} aria-label="Notifikasi"><Bell size={18} />{notifikasi.total > 0 && <span style={styles.notifDot}>{notifikasi.total > 99 ? "99+" : notifikasi.total}</span>}</button>{notifBuka && <div style={styles.notifPanel}><div style={styles.notifHeader}><strong>Notifikasi</strong><button type="button" onClick={() => setNotifBuka(false)} style={styles.iconButton}><X size={15} /></button></div>{notifikasi.total === 0 ? <div style={styles.empty}>Tidak ada notifikasi yang perlu diperiksa.</div> : <>{notifikasi.akunBaru > 0 && <button type="button" onClick={() => { setNotifBuka(false); pilihTab("approval"); }} style={styles.notifItem}><UserPlus size={16} />{notifikasi.akunBaru} akun menunggu aktivasi</button>}{notifikasi.izinBaru > 0 && <button type="button" onClick={() => { setNotifBuka(false); pilihTab("izin"); }} style={styles.notifItem}><FileText size={16} />{notifikasi.izinBaru} pengajuan izin menunggu</button>}</>}<div style={styles.notifFooter}>Pembaruan otomatis setiap 15 detik</div></div>}</div></header>

        {(pesan || sukses) && <div style={pesan ? styles.toastError : styles.toastSuccess}><strong>{pesan ? "Perhatian" : "Berhasil"}</strong><span>{pesan || sukses}</span></div>}

        {tab === "rekap" && <section>
          <div style={styles.statGrid}><StatCard label="Karyawan Aktif" value={jumlahAktif} icon={Users} /><StatCard label="Tepat Waktu" value={jumlahTepatWaktu} icon={CheckCircle2} tone="sukses" /><StatCard label="Telat" value={jumlahTelat} icon={AlertTriangle} tone="peringatan" /><StatCard label="Izin/Sakit/Cuti" value={jumlahIzin} icon={FileText} /><button type="button" onClick={() => setBelumAbsenBuka((v) => !v)} style={styles.statButton}><Users size={18} /><strong>{belumAbsen.length}</strong><span>Belum Absen</span></button></div>
          {belumAbsenBuka && <div style={styles.panel}><div style={styles.panelTitleRow}><div><strong>Karyawan Belum Absen</strong><p style={styles.muted}>Karyawan aktif yang belum memiliki absensi pada tanggal rekap.</p></div><button type="button" onClick={() => setBelumAbsenBuka(false)} style={styles.smallButton}>Tutup</button></div>{belumAbsen.length === 0 ? <div style={styles.empty}>Semua karyawan aktif sudah memiliki absensi atau pengajuan yang disetujui.</div> : <div style={styles.listGrid}>{belumAbsen.map((item) => <div key={item.id} style={styles.listItem}><div style={styles.avatar}>{inisialNama(item.nama)}</div><div><strong>{item.nama}</strong><p style={styles.muted}>{item.jabatan || "-"} · {item.divisi || "-"}</p></div></div>)}</div>}</div>}
          <input value={pencarian} onChange={(e) => setPencarian(e.target.value)} placeholder="Cari nama, jabatan, atau divisi…" style={styles.search} />
          <div style={styles.tableHint}>Geser tabel ke kanan di HP untuk melihat semua kolom.</div>
          <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.stickyHead}>Karyawan</th>{tampilkanFoto && <th>Foto</th>}<th>Status</th><th>Masuk</th><th>Pulang</th><th>Lokasi Masuk</th></tr></thead><tbody>{loading ? <Skeleton rows={4} cols={tampilkanFoto ? 6 : 5} /> : rekapTersaring.length === 0 ? <tr><td colSpan={tampilkanFoto ? 6 : 5} style={styles.emptyCell}>Tidak ada data rekap.</td></tr> : rekapTersaring.map((item) => { const status = labelStatusKehadiran(item.statusFinal || item.statusOtomatis); return <tr key={item.id}><td style={{ ...styles.td, ...styles.stickyCell }}><div style={{ display: "flex", gap: 8, alignItems: "center" }}><div style={styles.avatarSmall}>{inisialNama(item.pengguna?.nama)}</div><div><strong>{item.pengguna?.nama || "-"}</strong><div style={styles.muted}>{item.pengguna?.jabatan || "-"} · {item.pengguna?.divisi || "-"}</div></div></div></td>{tampilkanFoto && <td style={styles.td}><div style={{ display: "flex", gap: 6 }}>{item.fotoMasukUrl ? <a href={item.fotoMasukUrl} target="_blank" rel="noopener noreferrer"><img src={item.fotoMasukUrl} alt="Masuk" style={styles.thumb} /></a> : null}{item.fotoPulangUrl ? <a href={item.fotoPulangUrl} target="_blank" rel="noopener noreferrer"><img src={item.fotoPulangUrl} alt="Pulang" style={styles.thumb} /></a> : null}</div></td>}<td style={styles.td}><span style={{ ...styles.statusBadge, color: status.warna, background: status.latar }}>{status.teks}</span></td><td style={{ ...styles.td, fontFamily: font.mono }}>{formatJam(item.jamMasuk)}</td><td style={{ ...styles.td, fontFamily: font.mono }}>{formatJam(item.jamPulang)}</td><td style={styles.td}><div>{item.alamatMasuk || "Lokasi GPS belum tersedia"}</div><div style={styles.muted}>{item.latitudeMasuk != null && item.longitudeMasuk != null ? `${item.latitudeMasuk}, ${item.longitudeMasuk}` : ""}</div></td></tr>; })}</tbody></table></div>
        </section>}

        {tab === "approval" && <section><div style={styles.sectionHeader}><div><h2 style={styles.sectionTitle}>Akun Menunggu Aktivasi</h2><p style={styles.muted}>Pilih Homebase karyawan secara eksplisit saat akun diaktifkan.</p></div><button type="button" onClick={() => void muatDashboard()} style={styles.smallButton}><RefreshCcw size={14} /> Refresh</button></div>{menunggu.length === 0 ? <div style={styles.emptyBox}><CheckCircle2 size={30} /><p>Tidak ada akun menunggu.</p></div> : <div style={styles.cardGrid}>{menunggu.map((item) => <div key={item.id} style={styles.card}><div style={styles.cardHead}><div style={styles.avatar}>{inisialNama(item.nama)}</div><div style={{ minWidth: 0, flex: 1 }}><strong>{item.nama}</strong><div style={styles.muted}>{item.email}</div></div></div>{formAktivasiId === item.id ? <div style={styles.formBox}><Field label="Jabatan"><input value={formAktivasi.jabatan} onChange={(e) => setFormAktivasi({ ...formAktivasi, jabatan: e.target.value })} style={styles.input} placeholder="Contoh: Teknisi" /></Field><Field label="Divisi"><input value={formAktivasi.divisi} onChange={(e) => setFormAktivasi({ ...formAktivasi, divisi: e.target.value })} style={styles.input} placeholder="Contoh: Operasional" /></Field><Field label="Homebase Karyawan"><select value={formAktivasi.kantorId} onChange={(e) => setFormAktivasi({ ...formAktivasi, kantorId: e.target.value })} style={styles.input}><option value="">Pilih homebase…</option>{kantor.map((k) => <option key={k.id} value={k.id}>{k.namaKantor}{k.alamat ? ` — ${k.alamat}` : ""}</option>)}</select><span style={styles.help}>Homebase adalah kantor organisasi karyawan dan tidak berubah hanya karena karyawan sedang bekerja di kota lain.</span></Field><div style={styles.formActions}><button type="button" onClick={() => setFormAktivasiId(null)} style={styles.smallButton}>Batal</button><button type="button" onClick={() => void kirimAktivasi(item.id)} style={styles.primaryButton}>Simpan & Aktifkan</button></div></div> : <button type="button" onClick={() => void bukaFormAktivasi(item)} style={styles.primaryButton}>Aktifkan Akun</button>}</div>)}</div>}</section>}

        {tab === "karyawan" && <section><div style={styles.sectionHeader}><div><h2 style={styles.sectionTitle}>Karyawan</h2><p style={styles.muted}>Kelola profil, Homebase, password, dan status akun.</p></div><button type="button" onClick={() => void muatKaryawan({ force: true })} style={styles.smallButton}><RefreshCcw size={14} /> Refresh</button></div><input value={pencarian} onChange={(e) => setPencarian(e.target.value)} placeholder="Cari nama, email, jabatan, divisi, atau homebase…" style={styles.search} /><div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={styles.stickyHead}>Nama</th><th>Email</th><th>Jabatan / Divisi</th><th>Homebase</th><th>Status</th><th></th></tr></thead><tbody>{loadingKaryawan ? <Skeleton rows={5} cols={6} /> : karyawanTersaring.length === 0 ? <tr><td colSpan={6} style={styles.emptyCell}>Belum ada data karyawan.</td></tr> : karyawanTersaring.map((item) => <tr key={item.id}><td style={{ ...styles.td, ...styles.stickyCell }}><div style={{ display: "flex", gap: 8, alignItems: "center" }}><div style={styles.avatarSmall}>{inisialNama(item.nama)}</div><strong>{item.nama}</strong></div></td><td style={styles.td}>{item.email}</td><td style={styles.td}>{item.jabatan || "-"}<div style={styles.muted}>{item.divisi || "-"}</div></td><td style={styles.td}>{item.kantor?.namaKantor || <span style={{ color: warna.bahaya }}>Belum ditentukan</span>}</td><td style={styles.td}><span style={{ ...styles.statusBadge, color: item.statusAkun === "aktif" ? warna.sukses : warna.tintaSamar, background: item.statusAkun === "aktif" ? warna.suksesLembut : warna.panelAlt }}>{item.statusAkun === "aktif" ? "Aktif" : "Nonaktif"}</span></td><td style={{ ...styles.td, textAlign: "right" }}><div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}><button type="button" onClick={() => bukaEditKaryawan(item)} style={styles.smallButton}>Edit</button><button type="button" onClick={() => void resetPasswordKaryawan(item.id)} style={styles.smallButton}>Reset Password</button>{item.statusAkun === "aktif" ? <button type="button" onClick={() => setKonfirmasiNonaktif(item.id)} style={{ ...styles.smallButton, color: warna.bahaya }}>Nonaktifkan</button> : <button type="button" onClick={() => void ubahStatusKaryawan(item.id, "aktif")} style={styles.smallButton}>Aktifkan</button>}</div></td></tr>)}</tbody></table></div>{formEditKaryawanId != null && <Modal title="Edit Data Karyawan" onClose={() => setFormEditKaryawanId(null)}><Field label="Email"><input value={formEditKaryawan.email} onChange={(e) => setFormEditKaryawan({ ...formEditKaryawan, email: e.target.value })} style={styles.input} type="email" /></Field><Field label="Jabatan"><input value={formEditKaryawan.jabatan} onChange={(e) => setFormEditKaryawan({ ...formEditKaryawan, jabatan: e.target.value })} style={styles.input} /></Field><Field label="Divisi"><input value={formEditKaryawan.divisi} onChange={(e) => setFormEditKaryawan({ ...formEditKaryawan, divisi: e.target.value })} style={styles.input} /></Field><Field label="Homebase"><select value={formEditKaryawan.kantorId} onChange={(e) => setFormEditKaryawan({ ...formEditKaryawan, kantorId: e.target.value })} style={styles.input}><option value="">Tanpa homebase</option>{kantor.map((k) => <option key={k.id} value={k.id}>{k.namaKantor}</option>)}</select></Field><div style={styles.formActions}><button type="button" onClick={() => setFormEditKaryawanId(null)} style={styles.smallButton}>Batal</button><button type="button" onClick={() => void simpanEditKaryawan()} style={styles.primaryButton}>Simpan Perubahan</button></div></Modal>}{konfirmasiNonaktif != null && <Modal title="Nonaktifkan Karyawan" onClose={() => setKonfirmasiNonaktif(null)}><p style={styles.muted}>Akun ini tidak dapat login sampai diaktifkan kembali.</p><div style={styles.formActions}><button type="button" onClick={() => setKonfirmasiNonaktif(null)} style={styles.smallButton}>Batal</button><button type="button" onClick={() => void ubahStatusKaryawan(konfirmasiNonaktif, "nonaktif")} style={{ ...styles.primaryButton, background: warna.bahaya }}>Ya, Nonaktifkan</button></div></Modal>}{resetPassword && <Modal title="Password Sementara" onClose={() => setResetPassword(null)}><p style={styles.muted}>Password ini hanya ditampilkan sekali. Sampaikan kepada karyawan melalui saluran yang aman dan minta segera menggantinya.</p><div style={styles.passwordBox}>{resetPassword.password}</div><button type="button" onClick={() => setResetPassword(null)} style={styles.primaryButton}>Tutup</button></Modal>}</section>}

        {tab === "izin" && <AdminIzin />}
        {tab === "gaji" && <PengaturanGaji />}
        {tab === "gaji-massal" && <AdminGajiMassal />}

        {tab === "kantor" && <section><div style={styles.sectionHeader}><div><h2 style={styles.sectionTitle}>Kantor & Homebase</h2><p style={styles.muted}>Kelola master kantor. GPS absensi mencatat lokasi aktual karyawan; data kantor hanya menentukan Homebase organisasi.</p></div><button type="button" onClick={() => void muatKantor()} style={styles.smallButton}><RefreshCcw size={14} /> Refresh</button></div><div style={styles.card}><h3 style={styles.cardTitle}>{kantorEditId ? "Edit Data Kantor" : "Tambah Kantor"}</h3><div style={styles.formGrid}><Field label="Nama Kantor"><input value={formKantor.namaKantor} onChange={(e) => setFormKantor({ ...formKantor, namaKantor: e.target.value })} style={styles.input} placeholder="Contoh: Homebase Bandung" /></Field><Field label="Alamat"><input value={formKantor.alamat} onChange={(e) => setFormKantor({ ...formKantor, alamat: e.target.value })} style={styles.input} placeholder="Alamat kantor" /></Field><Field label="Latitude (opsional)"><input value={formKantor.latitude} onChange={(e) => setFormKantor({ ...formKantor, latitude: e.target.value })} style={styles.input} inputMode="decimal" /></Field><Field label="Longitude (opsional)"><input value={formKantor.longitude} onChange={(e) => setFormKantor({ ...formKantor, longitude: e.target.value })} style={styles.input} inputMode="decimal" /></Field></div><div style={styles.formActions}><button type="button" onClick={() => void gunakanLokasiSekarang()} style={styles.smallButton}><Navigation size={14} /> Gunakan Lokasi Saat Ini</button><button type="button" onClick={() => bukaFormTambahKantor()} style={styles.smallButton}>Reset Form</button><button type="button" onClick={() => void simpanKantor()} style={styles.primaryButton} disabled={simpanKantorLoading}><Save size={14} /> {simpanKantorLoading ? "Menyimpan…" : "Simpan"}</button></div></div><div style={styles.cardGrid}>{loadingKantor ? <SkeletonCards /> : kantor.map((item) => <div key={item.id} style={styles.card}><div style={styles.cardHead}><div style={styles.avatar}><Building2 size={17} /></div><div style={{ minWidth: 0, flex: 1 }}><strong>{item.namaKantor}</strong><div style={styles.muted}>{item.alamat || "Alamat belum diisi"}</div></div><span style={styles.statusBadge}>{item._count?.pengguna ?? 0} karyawan</span></div><div style={styles.metaGrid}><div><span style={styles.muted}>Koordinat</span><strong>{item.latitude != null && item.longitude != null ? "Tersedia" : "Belum diisi"}</strong></div><div><span style={styles.muted}>Homebase</span><strong>Siap dipilih saat aktivasi/edit</strong></div></div><button type="button" onClick={() => bukaFormEditKantor(item)} style={styles.smallButton}>Edit Data</button></div>)}{!loadingKantor && kantor.length === 0 && <div style={styles.emptyBox}><Building2 size={28} /><p>Belum ada data kantor.</p><button type="button" onClick={() => bukaFormTambahKantor()} style={styles.primaryButton}>Tambah Kantor Pertama</button></div>}</div></section>}

        {tab === "pengaturan" && <section><div style={styles.sectionHeader}><div><h2 style={styles.sectionTitle}>Pengaturan Sistem</h2><p style={styles.muted}>Pengaturan global yang benar-benar memengaruhi perilaku sistem.</p></div></div><div style={styles.card}><div style={styles.cardHead}><div style={styles.settingIcon}><Shield size={18} /></div><div><strong>Aturan Jam Kerja & Potongan</strong><p style={styles.muted}>Jam standar dipakai server untuk menentukan tepat waktu atau telat. Semua tampilan Admin menggunakan WIB.</p></div></div><div style={styles.formGrid}><Field label="Jam Masuk Standar"><input type="time" value={jamMasukStandar} onChange={(e) => setJamMasukStandar(e.target.value)} style={styles.input} /></Field><Field label="Potongan Telat (Rp)"><input type="number" min="0" value={potongan.potonganTelat} onChange={(e) => setPotongan({ ...potongan, potonganTelat: e.target.value })} style={styles.input} /></Field><Field label="Potongan Alpha (Rp)"><input type="number" min="0" value={potongan.potonganAlpha} onChange={(e) => setPotongan({ ...potongan, potonganAlpha: e.target.value })} style={styles.input} /></Field></div><div style={styles.formActions}><button type="button" onClick={() => void simpanAturan()} style={styles.primaryButton} disabled={simpanAturanLoading}><Save size={14} /> {simpanAturanLoading ? "Menyimpan…" : "Simpan Aturan"}</button></div></div><div style={styles.card}><div style={styles.cardHead}><div style={styles.settingIcon}><BarChart3 size={18} /></div><div><strong>Tampilan Rekap</strong><p style={styles.muted}>Preferensi hanya berlaku pada perangkat Admin ini dan tidak mengubah data bisnis.</p></div></div><div style={styles.optionRow}>{["ringkas", "normal", "lega"].map((mode) => <button type="button" key={mode} onClick={() => { setKepadatan(mode); try { localStorage.setItem("zaman-admin-density", mode); } catch {} }} style={kepadatan === mode ? styles.optionActive : styles.option}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}<label style={styles.checkbox}><input type="checkbox" checked={tampilkanFoto} onChange={(e) => { setTampilkanFoto(e.target.checked); try { localStorage.setItem("zaman-admin-show-photos", String(e.target.checked)); } catch {} }} /> Tampilkan foto absensi</label></div></div><div style={styles.card}><div style={styles.cardHead}><div style={styles.settingIcon}><Building2 size={18} /></div><div><strong>Homebase & Lokasi</strong><p style={styles.muted}>Radius absensi tidak digunakan untuk memblokir absen. GPS tetap disimpan sebagai lokasi aktual.</p></div></div><button type="button" onClick={() => pilihTab("kantor")} style={styles.primaryButton}>Kelola Kantor & Homebase</button></div><div style={styles.card}><div style={styles.cardHead}><div style={styles.settingIcon}><Settings size={18} /></div><div><strong>Pengguna & Keamanan</strong><p style={styles.muted}>Password Admin dikelola dari halaman keamanan. Reset password karyawan tersedia di menu Karyawan.</p></div></div><button type="button" onClick={() => navigate("/ganti-password")} style={styles.smallButton}>Ganti Password Admin</button></div></section>}
      </main>
      <style>{`@media (max-width: 860px) { .admin-sidebar { position: fixed !important; inset: 0 auto 0 0 !important; width: 240px !important; transform: translateX(-105%); transition: transform .18s ease; box-shadow: 12px 0 30px rgba(15,23,42,.12); } .admin-sidebar.sidebar-mobile-terbuka { transform: translateX(0); } .main-area-admin { width: 100%; } } @media (min-width: 861px) { .admin-sidebar { transform: none !important; } } @media (max-width: 860px) { .mobile-overlay { display: block; } } @media (min-width: 861px) { .mobile-overlay { display: none; } }`}</style>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }) {
  const color = tone === "sukses" ? warna.sukses : tone === "peringatan" ? warna.peringatan : warna.aksen;
  const bg = tone === "sukses" ? warna.suksesLembut : tone === "peringatan" ? warna.peringatanLembut : warna.aksenLembut;
  return <div style={{ ...styles.statCard, borderLeft: `3px solid ${color}` }}><div style={{ ...styles.statIcon, color, background: bg }}><Icon size={17} /></div><strong style={{ ...styles.statValue, color }}>{value}</strong><span style={styles.statLabel}>{label}</span></div>;
}

function Field({ label, children }) { return <label style={styles.field}><span style={styles.fieldLabel}>{label}</span>{children}</label>; }
function Modal({ title, onClose, children }) { return <div style={styles.modalBackdrop}><div style={styles.modal}><div style={styles.modalHeader}><strong>{title}</strong><button type="button" onClick={onClose} style={styles.iconButton}><X size={16} /></button></div>{children}</div></div>; }
function Skeleton({ rows = 4, cols = 5 }) { return Array.from({ length: rows }).map((_, row) => <tr key={row}><td colSpan={cols} style={{ padding: 14 }}><div style={{ height: 12, width: `${45 + (row % 3) * 15}%`, background: warna.panelAlt, borderRadius: 6 }} /></td></tr>); }
function SkeletonCards() { return Array.from({ length: 3 }).map((_, i) => <div key={i} style={styles.card}><div style={{ height: 12, width: "50%", background: warna.panelAlt, borderRadius: 6, marginBottom: 10 }} /><div style={{ height: 10, width: "75%", background: warna.panelAlt, borderRadius: 6 }} /></div>); }

const styles = {
  shell: { display: "flex", height: "100svh", overflow: "hidden", background: warna.latar, fontFamily: font.display, color: warna.tinta },
  sidebar: { width: 240, flexShrink: 0, display: "flex", flexDirection: "column", background: warna.panel, borderRight: `1px solid ${warna.garis}`, padding: "20px 14px", overflowY: "auto", zIndex: 50 },
  logoWrap: { padding: "4px 8px 22px" }, logo: { width: "100%", maxWidth: 190, height: "auto" },
  nav: { flex: 1, display: "grid", alignContent: "start", gap: 4 }, groupTitle: { margin: "12px 10px 5px", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.09em", color: warna.tintaSamar },
  navItem: { width: "100%", border: 0, background: "transparent", borderRadius: 9, padding: "10px 11px", display: "flex", alignItems: "center", gap: 9, color: warna.tintaLembut, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  navActive: { width: "100%", border: 0, background: warna.aksenLembut, borderRadius: 9, padding: "10px 11px", display: "flex", alignItems: "center", gap: 9, color: warna.aksen, cursor: "pointer", fontSize: 13, fontWeight: 750 },
  badge: { background: warna.bahaya, color: "#fff", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800 },
  sidebarBottom: { borderTop: `1px solid ${warna.garis}`, paddingTop: 13, marginTop: 12 }, profileRow: { display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }, profileName: { display: "block", fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, profileRole: { display: "block", fontSize: 10.5, color: warna.tintaSamar },
  avatar: { width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: warna.tinta, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800 }, avatarSmall: { width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: warna.aksenLembut, color: warna.aksen, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800 },
  smallButton: { minHeight: 36, padding: "7px 10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tintaLembut, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }, primaryButton: { minHeight: 38, padding: "8px 12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, border: 0, background: warna.aksen, color: "#fff", fontSize: 11.5, fontWeight: 750, cursor: "pointer" },
  main: { flex: 1, minWidth: 0, overflowY: "auto", padding: "25px 30px" }, mobileBar: { display: "none", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }, header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 20 }, title: { margin: 0, fontSize: 24, fontWeight: 800 }, subtitle: { margin: "4px 0 0", fontSize: 12, color: warna.tintaSamar },
  iconButton: { position: "relative", width: 38, height: 38, borderRadius: 9, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tinta, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }, notifDot: { position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: warna.bahaya, color: "#fff", border: "2px solid #fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" },
  notifPanel: { position: "absolute", right: 0, top: 44, width: 320, maxWidth: "calc(100vw - 28px)", background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 12, boxShadow: "0 18px 40px rgba(22,35,61,.14)", overflow: "hidden", zIndex: 100 }, notifHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${warna.garis}` }, notifItem: { width: "100%", border: 0, borderBottom: `1px solid ${warna.garis}`, background: "transparent", padding: "12px 14px", display: "flex", alignItems: "center", gap: 8, textAlign: "left", cursor: "pointer", color: warna.tinta, fontSize: 11.5, fontWeight: 700 }, notifFooter: { padding: 9, fontSize: 9.5, color: warna.tintaSamar, textAlign: "center", background: warna.panelAlt },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 10, marginBottom: 18 }, statCard: { background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 4 }, statIcon: { width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 5 }, statValue: { fontFamily: font.mono, fontSize: 24 }, statLabel: { fontSize: 11.5, color: warna.tintaLembut }, statButton: { border: `1px solid ${warna.garis}`, background: warna.panel, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, cursor: "pointer", color: warna.tinta },
  panel: { background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 11, padding: 14, marginBottom: 14 }, panelTitleRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }, listGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }, listItem: { display: "flex", alignItems: "center", gap: 8, padding: 9, borderRadius: 8, background: warna.panelAlt },
  search: { width: "100%", maxWidth: 420, minHeight: 40, padding: "8px 11px", borderRadius: 9, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tinta, fontSize: 12, marginBottom: 9, boxSizing: "border-box" }, tableHint: { fontSize: 10.5, color: warna.tintaSamar, marginBottom: 6 }, tableWrap: { overflow: "auto", borderRadius: 11, border: `1px solid ${warna.garis}`, background: warna.panel }, table: { width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 12 }, stickyHead: { position: "sticky", left: 0, zIndex: 2, background: warna.panelAlt }, stickyCell: { position: "sticky", left: 0, zIndex: 1, background: warna.panel, boxShadow: `1px 0 0 ${warna.garis}` }, td: { padding: "11px 10px", borderBottom: `1px solid ${warna.garis}`, verticalAlign: "top" }, emptyCell: { padding: 35, textAlign: "center", color: warna.tintaSamar }, thumb: { width: 46, height: 46, objectFit: "cover", borderRadius: 7, border: `1px solid ${warna.garis}` }, statusBadge: { display: "inline-flex", alignItems: "center", padding: "4px 8px", borderRadius: 999, fontSize: 9.5, fontWeight: 750, whiteSpace: "nowrap" }, muted: { margin: "2px 0 0", fontSize: 10.5, lineHeight: 1.45, color: warna.tintaSamar },
  sectionHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }, sectionTitle: { margin: 0, fontSize: 18, fontWeight: 800 }, cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 10 }, card: { background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 11, padding: 14 }, cardHead: { display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 12 }, cardTitle: { margin: "0 0 14px", fontSize: 14, fontWeight: 800 }, formBox: { display: "grid", gap: 9 }, field: { display: "grid", gap: 5 }, fieldLabel: { fontSize: 10.5, color: warna.tintaLembut, fontWeight: 700 }, input: { width: "100%", minHeight: 40, padding: "8px 10px", borderRadius: 8, border: `1px solid ${warna.garis}`, background: "#fff", color: warna.tinta, fontSize: 12, boxSizing: "border-box", fontFamily: font.display }, help: { fontSize: 10, color: warna.tintaSamar, lineHeight: 1.45 }, formActions: { display: "flex", gap: 7, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 4 }, passwordBox: { fontFamily: font.mono, fontSize: 18, fontWeight: 800, letterSpacing: "0.08em", padding: 13, borderRadius: 9, border: `1px dashed ${warna.aksen}`, background: warna.aksenLembut, color: warna.aksen, textAlign: "center", margin: "12px 0" }, formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }, metaGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 11 }, settingIcon: { width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: warna.aksenLembut, color: warna.aksen, flexShrink: 0 }, optionRow: { display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }, option: { padding: "8px 10px", border: `1px solid ${warna.garis}`, background: warna.panel, borderRadius: 8, fontSize: 11.5, cursor: "pointer" }, optionActive: { padding: "8px 10px", border: `1px solid ${warna.aksen}`, background: warna.aksenLembut, color: warna.aksen, borderRadius: 8, fontSize: 11.5, cursor: "pointer", fontWeight: 750 }, checkbox: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: warna.tintaLembut }, emptyBox: { display: "grid", placeItems: "center", gap: 8, minHeight: 180, padding: 20, border: `1px dashed ${warna.garis}`, borderRadius: 11, color: warna.tintaSamar, textAlign: "center" },
  toastError: { position: "fixed", top: 18, right: 18, zIndex: 200, width: "min(400px, calc(100vw - 36px))", display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 10, background: warna.panel, color: warna.bahaya, border: `1px solid ${warna.bahayaLembut}`, boxShadow: "0 16px 35px rgba(22,35,61,.12)", fontSize: 12 }, toastSuccess: { position: "fixed", top: 18, right: 18, zIndex: 200, width: "min(400px, calc(100vw - 36px))", display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: 10, background: warna.panel, color: warna.sukses, border: `1px solid ${warna.suksesLembut}`, boxShadow: "0 16px 35px rgba(22,35,61,.12)", fontSize: 12 },
  modalBackdrop: { position: "fixed", inset: 0, zIndex: 300, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }, modal: { width: "min(520px,100%)", maxHeight: "90svh", overflowY: "auto", background: warna.panel, borderRadius: 14, padding: 16, boxShadow: "0 25px 70px rgba(15,23,42,.25)" }, modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, fontSize: 14 }, mobileOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", zIndex: 40 },
};
